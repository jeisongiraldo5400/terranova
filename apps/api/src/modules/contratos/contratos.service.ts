import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { ErrorNoEncontrado, ErrorReglaNegocio } from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { type DatosContrato, generarContratoPdf } from './contrato-pdf.js';

@Injectable()
export class ContratosService {
  private readonly directorio: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    config: ConfigService,
  ) {
    this.directorio = resolve(config.get<string>('CONTRATOS_DIR', './contratos'));
  }

  /**
   * Genera el contrato o devuelve el vigente.
   *
   * La numeracion viene de una secuencia de Postgres, de modo que no hay
   * huecos ni repetidos aunque dos usuarios generen a la vez. Regenerar
   * crea una version nueva en lugar de sobreescribir: el documento que el
   * cliente firmo nunca se pierde.
   */
  async generar(ventaId: string, regenerar: boolean, usuario: UsuarioActual) {
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: true,
        lote: { include: { proyecto: true, etapa: true } },
        plan: { include: { cuotas: { orderBy: { numero: 'asc' } } } },
        contratos: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!venta) throw new ErrorNoEncontrado('Venta', ventaId);

    if (venta.estado === 'ANULADA') {
      throw new ErrorReglaNegocio('No se puede generar el contrato de una venta anulada.');
    }
    if (!venta.plan) {
      throw new ErrorReglaNegocio('La venta no tiene plan de pago; no se puede emitir contrato.');
    }

    const vigente = venta.contratos[0];
    if (vigente && !regenerar) return vigente;

    const empresa = await this.prisma.configuracionEmpresa.findUnique({ where: { id: 1 } });
    if (!empresa) {
      throw new ErrorReglaNegocio(
        'Falta configurar los datos de la empresa antes de emitir contratos. ' +
          'Vaya al modulo Configuracion.',
      );
    }

    const version = (vigente?.version ?? 0) + 1;
    const numero = vigente?.numero ?? (await this.siguienteNumero());
    const generadoEn = new Date();

    const datos: DatosContrato = {
      numero,
      version,
      empresa,
      venta: {
        numero: venta.numero,
        fechaVenta: venta.fechaVenta,
        precioNegociado: venta.precioNegociado.toFixed(2),
      },
      cliente: {
        tipoDocumento: venta.cliente.tipoDocumento,
        documento: venta.cliente.documento,
        nombre: venta.cliente.nombre,
        telefono: venta.cliente.telefono,
        direccion: venta.cliente.direccion,
        ciudad: venta.cliente.ciudad,
      },
      lote: {
        codigo: venta.lote.codigo,
        areaM2: venta.lote.areaM2.toFixed(2),
        proyecto: venta.lote.proyecto.nombre,
        ubicacion: venta.lote.proyecto.ubicacion,
        etapa: venta.lote.etapa?.nombre ?? null,
      },
      plan: {
        cuotaInicial: venta.plan.cuotaInicial.toFixed(2),
        saldoFinanciado: venta.plan.saldoFinanciado.toFixed(2),
        cuotas: venta.plan.cuotas.map((c) => ({
          numero: c.numero,
          descripcion: c.descripcion,
          montoEsperado: c.montoEsperado.toFixed(2),
          fechaVencimiento: c.fechaVencimiento,
        })),
      },
      generadoPor: usuario.nombre,
      generadoEn,
    };

    const pdf = await generarContratoPdf(datos);
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const storageKey = join(
      String(venta.fechaVenta.getUTCFullYear()),
      venta.lote.proyecto.codigo,
      `${numero}-v${version}.pdf`,
    );

    const rutaAbsoluta = join(this.directorio, storageKey);
    await mkdir(dirname(rutaAbsoluta), { recursive: true });
    await writeFile(rutaAbsoluta, pdf);

    const contrato = await this.prisma.contrato.create({
      data: {
        ventaId: venta.id,
        numero,
        version,
        storageKey,
        sha256,
        bytes: pdf.byteLength,
        // Instantanea de los datos firmados. Si el cliente cambia de
        // direccion manana, este contrato sigue reflejando lo acordado.
        datosSnapshot: JSON.parse(JSON.stringify(datos)),
        generadoPorId: usuario.id,
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: version === 1 ? 'CONTRATO_GENERADO' : 'CONTRATO_REGENERADO',
      entidad: 'Contrato',
      entidadId: contrato.id,
      despues: { numero, version, sha256, bytes: pdf.byteLength },
    });

    return contrato;
  }

  /** Lee el PDF archivado y verifica su integridad contra el hash guardado. */
  async descargar(contratoId: string): Promise<{ nombre: string; pdf: Buffer }> {
    const contrato = await this.prisma.contrato.findUnique({ where: { id: contratoId } });
    if (!contrato) throw new ErrorNoEncontrado('Contrato', contratoId);

    let pdf: Buffer;
    try {
      pdf = await readFile(join(this.directorio, contrato.storageKey));
    } catch (e) {
      // Pasa en servidores con disco efimero (Railway sin volumen): el
      // registro sobrevive en la base pero el archivo se perdio al redesplegar.
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ErrorReglaNegocio(
          'El archivo de este contrato ya no esta en el servidor. ' +
            'Regenere el contrato desde el detalle de la venta.',
        );
      }
      throw e;
    }
    const hashActual = createHash('sha256').update(pdf).digest('hex');

    if (hashActual !== contrato.sha256) {
      // El archivo se altero despues de emitirse. No se entrega.
      throw new ErrorReglaNegocio(
        'El archivo del contrato no coincide con su huella registrada. ' +
          'Puede haber sido modificado; regenere el documento.',
        { esperado: contrato.sha256, encontrado: hashActual },
      );
    }

    return { nombre: `${contrato.numero}-v${contrato.version}.pdf`, pdf };
  }

  listar(filtro: { ventaId?: string; proyectoId?: string }) {
    return this.prisma.contrato.findMany({
      where: {
        ...(filtro.ventaId ? { ventaId: filtro.ventaId } : {}),
        ...(filtro.proyectoId ? { venta: { lote: { proyectoId: filtro.proyectoId } } } : {}),
      },
      orderBy: [{ generadoEn: 'desc' }],
      include: {
        venta: {
          select: {
            numero: true,
            fechaVenta: true,
            precioNegociado: true,
            estado: true,
            lote: { select: { codigo: true, proyecto: { select: { nombre: true } } } },
            cliente: { select: { documento: true, nombre: true } },
          },
        },
        generadoPor: { select: { nombre: true } },
      },
    });
  }

  /**
   * Consecutivo anual: CT-2026-00001. Usa una secuencia de Postgres, no un
   * COUNT, para que dos peticiones simultaneas no obtengan el mismo numero.
   */
  private async siguienteNumero(): Promise<string> {
    const anio = new Date().getUTCFullYear();
    const secuencia = `contrato_numero_${anio}`;

    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS ${secuencia} START 1 MINVALUE 1`,
    );
    const [fila] = await this.prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>(
      `SELECT nextval('${secuencia}') AS nextval`,
    );

    return `CT-${anio}-${String(Number(fila!.nextval)).padStart(5, '0')}`;
  }
}
