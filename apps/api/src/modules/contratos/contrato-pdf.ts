/* ==========================================================================
   Generacion del PDF del contrato
   --------------------------------------------------------------------------
   En el v0 el PDF se armaba en el navegador con jsPDF, con coordenadas
   absolutas escritas a mano (Contratos.jsx:65 y siguientes) y sin
   numeracion ni archivo. Cada equipo producia un documento distinto y no
   quedaba copia de lo que se entrego al cliente.

   Aqui se genera en el servidor, de forma deterministica, y el llamador lo
   archiva con su hash sha256.
   ========================================================================== */

import PDFDocument from 'pdfkit';
import { formatearCOP } from '@terranova/shared';

export interface DatosContrato {
  numero: string;
  version: number;
  empresa: {
    razonSocial: string;
    nit: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    email: string;
    representanteLegal: string;
    documentoRepresentante: string;
    clausulasContrato: string | null;
  };
  venta: {
    numero: number;
    fechaVenta: Date;
    precioNegociado: string;
  };
  cliente: {
    tipoDocumento: string;
    documento: string;
    nombre: string;
    telefono: string;
    direccion: string | null;
    ciudad: string | null;
  };
  lote: {
    codigo: string;
    areaM2: string;
    proyecto: string;
    ubicacion: string | null;
    etapa: string | null;
  };
  plan: {
    cuotaInicial: string;
    saldoFinanciado: string;
    cuotas: Array<{
      numero: number;
      descripcion: string;
      montoEsperado: string;
      fechaVencimiento: Date;
    }>;
  };
  generadoPor: string;
  generadoEn: Date;
}

const COLOR_MARCA = '#1e3a8a';
const COLOR_TEXTO = '#0f172a';
const COLOR_SUAVE = '#64748b';
const MARGEN = 56;

const fechaLarga = (f: Date): string =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(f);

const fechaCorta = (f: Date): string =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(f);

/** Devuelve el PDF completo en memoria, listo para hashear y archivar. */
export function generarContratoPdf(datos: DatosContrato): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
      info: {
        Title: `Contrato de compraventa ${datos.numero}`,
        Author: datos.empresa.razonSocial,
        Subject: `Lote ${datos.lote.codigo} - ${datos.lote.proyecto}`,
        Keywords: `contrato,compraventa,${datos.lote.codigo}`,
      },
    });

    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);

    const anchoUtil = doc.page.width - MARGEN * 2;

    // --- Encabezado ---------------------------------------------------
    doc.fillColor(COLOR_MARCA).fontSize(18).font('Helvetica-Bold')
      .text('CONTRATO DE COMPRAVENTA DE LOTE', { align: 'center' });

    doc.moveDown(0.3);
    doc.fillColor(COLOR_TEXTO).fontSize(12).font('Helvetica-Bold')
      .text(datos.empresa.razonSocial.toUpperCase(), { align: 'center' });

    doc.fontSize(8).font('Helvetica').fillColor(COLOR_SUAVE)
      .text(
        `NIT ${datos.empresa.nit}  |  ${datos.empresa.direccion}, ${datos.empresa.ciudad}  |  ` +
          `${datos.empresa.telefono}`,
        { align: 'center' },
      );

    doc.moveDown(0.6);
    doc.strokeColor(COLOR_MARCA).lineWidth(1.5)
      .moveTo(MARGEN, doc.y).lineTo(doc.page.width - MARGEN, doc.y).stroke();
    doc.moveDown(0.8);

    // Numero de contrato, destacado
    doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUAVE)
      .text(`Contrato No. ${datos.numero}`, { continued: true })
      .text(
        `Version ${datos.version}    Venta No. ${datos.venta.numero}    ` +
          `Fecha: ${fechaLarga(datos.venta.fechaVenta)}`,
        { align: 'right' },
      );
    doc.moveDown(1);

    // --- Comparecientes -----------------------------------------------
    seccion(doc, 'COMPARECIENTES');

    parrafo(
      doc,
      `Entre ${datos.empresa.razonSocial}, identificada con NIT ${datos.empresa.nit}, ` +
        `representada legalmente por ${datos.empresa.representanteLegal}, identificado(a) con ` +
        `documento No. ${datos.empresa.documentoRepresentante}, quien en adelante se denominara ` +
        `el VENDEDOR; y ${datos.cliente.nombre}, identificado(a) con ` +
        `${datos.cliente.tipoDocumento} No. ${datos.cliente.documento}, ` +
        `${datos.cliente.direccion ? `con domicilio en ${datos.cliente.direccion}, ` : ''}` +
        `${datos.cliente.ciudad ?? datos.empresa.ciudad}, telefono ${datos.cliente.telefono}, ` +
        `quien en adelante se denominara el COMPRADOR, se celebra el presente contrato de ` +
        `compraventa, que se regira por las siguientes clausulas.`,
      9.5,
    );
    doc.moveDown(0.9);

    // --- Identificacion del inmueble ----------------------------------
    seccion(doc, 'IDENTIFICACION DEL INMUEBLE');
    tabla(doc, anchoUtil, [
      ['Proyecto', datos.lote.proyecto],
      ...(datos.lote.etapa ? [['Etapa', datos.lote.etapa] as [string, string]] : []),
      ['Codigo del lote', datos.lote.codigo],
      ['Area', `${Number(datos.lote.areaM2).toLocaleString('es-CO')} m2`],
      ...(datos.lote.ubicacion ? [['Ubicacion', datos.lote.ubicacion] as [string, string]] : []),
    ]);
    doc.moveDown(0.9);

    // --- Precio y plan de pago ----------------------------------------
    seccion(doc, 'PRECIO Y PLAN DE PAGO');
    tabla(doc, anchoUtil, [
      ['Precio total acordado', formatearCOP(datos.venta.precioNegociado)],
      ['Cuota inicial', formatearCOP(datos.plan.cuotaInicial)],
      ['Saldo', formatearCOP(datos.plan.saldoFinanciado)],
    ]);

    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(COLOR_TEXTO)
      .text('Cuotas pactadas', MARGEN, doc.y, { width: anchoUtil });
    doc.moveDown(0.3);

    // Cabecera de la tabla de cuotas
    const cols = [40, anchoUtil - 240, 110, 90];
    const yCabecera = doc.y;
    doc.rect(MARGEN, yCabecera - 2, anchoUtil, 16).fill('#dbeafe');
    doc.fillColor(COLOR_MARCA).fontSize(8).font('Helvetica-Bold');
    let x = MARGEN + 4;
    ['No.', 'Concepto', 'Valor', 'Vence'].forEach((t, i) => {
      doc.text(t, x, yCabecera + 2, { width: cols[i]! - 8, align: i === 2 ? 'right' : 'left' });
      x += cols[i]!;
    });
    doc.y = yCabecera + 18;

    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_TEXTO);
    for (const cuota of datos.plan.cuotas) {
      const y = doc.y;
      let cx = MARGEN + 4;
      const celdas = [
        String(cuota.numero),
        cuota.descripcion,
        formatearCOP(cuota.montoEsperado),
        fechaCorta(cuota.fechaVencimiento),
      ];
      celdas.forEach((t, i) => {
        doc.text(t, cx, y, { width: cols[i]! - 8, align: i === 2 ? 'right' : 'left' });
        cx += cols[i]!;
      });
      doc.y = y + 14;
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(MARGEN, doc.y - 3).lineTo(doc.page.width - MARGEN, doc.y - 3).stroke();
    }

    // Devuelve el cursor al margen tras componer por columnas.
    doc.x = MARGEN;
    doc.moveDown(1);

    // --- Clausulas -----------------------------------------------------
    if (datos.empresa.clausulasContrato) {
      if (doc.y > doc.page.height - 260) doc.addPage();
      seccion(doc, 'CLAUSULAS');
      parrafo(doc, datos.empresa.clausulasContrato);
      doc.moveDown(1);
    }

    // --- Firmas --------------------------------------------------------
    if (doc.y > doc.page.height - 190) doc.addPage();
    doc.moveDown(1.5);

    const anchoFirma = (anchoUtil - 40) / 2;
    const yFirma = doc.y;

    [
      { titulo: 'EL VENDEDOR', nombre: datos.empresa.representanteLegal, doc: datos.empresa.documentoRepresentante },
      { titulo: 'EL COMPRADOR', nombre: datos.cliente.nombre, doc: datos.cliente.documento },
    ].forEach((firma, i) => {
      const fx = MARGEN + i * (anchoFirma + 40);
      doc.strokeColor(COLOR_TEXTO).lineWidth(0.8)
        .moveTo(fx, yFirma).lineTo(fx + anchoFirma, yFirma).stroke();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLOR_TEXTO)
        .text(firma.titulo, fx, yFirma + 6, { width: anchoFirma, align: 'center' });
      doc.font('Helvetica').fontSize(8)
        .text(firma.nombre, fx, yFirma + 18, { width: anchoFirma, align: 'center' })
        .text(`C.C. ${firma.doc}`, fx, yFirma + 29, { width: anchoFirma, align: 'center' });
    });

    // --- Pie de integridad ---------------------------------------------
    // Deja constancia de quien genero el documento y cuando. El hash
    // sha256 lo calcula y almacena el servicio al archivar el PDF.
    doc.fontSize(7).fillColor(COLOR_SUAVE).text(
      `Documento generado por ${datos.generadoPor} el ${fechaLarga(datos.generadoEn)} ` +
        `a las ${datos.generadoEn.toLocaleTimeString('es-CO')}. ` +
        `Contrato ${datos.numero} version ${datos.version}.`,
      MARGEN,
      doc.page.height - MARGEN - 12,
      { width: anchoUtil, align: 'center' },
    );

    doc.end();
  });
}

/**
 * Titulo de seccion.
 *
 * La x y el ancho van explicitos: PDFKit conserva la posicion horizontal
 * del ultimo text() y, despues de dibujar una tabla por columnas, los
 * titulos siguientes aparecian indentados a media pagina y el texto
 * siguiente se componia en una columna estrecha.
 */
function seccion(doc: PDFKit.PDFDocument, titulo: string): void {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_MARCA).text(titulo, MARGEN, doc.y, {
    width: doc.page.width - MARGEN * 2,
    align: 'left',
  });
  doc.moveDown(0.25);
}

/** Parrafo justificado a ancho completo, con la x restablecida. */
function parrafo(doc: PDFKit.PDFDocument, texto: string, tam = 9): void {
  doc.fontSize(tam).font('Helvetica').fillColor(COLOR_TEXTO).text(texto, MARGEN, doc.y, {
    width: doc.page.width - MARGEN * 2,
    align: 'justify',
    lineGap: 2,
  });
}

function tabla(doc: PDFKit.PDFDocument, ancho: number, filas: Array<[string, string]>): void {
  const anchoEtiqueta = 150;
  for (const [etiqueta, valor] of filas) {
    const y = doc.y;
    doc.fontSize(9).font('Helvetica').fillColor(COLOR_SUAVE)
      .text(etiqueta, MARGEN + 2, y, { width: anchoEtiqueta });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXTO)
      .text(valor, MARGEN + anchoEtiqueta, y, { width: ancho - anchoEtiqueta - 4 });
    doc.y = Math.max(doc.y, y + 14);
  }
  doc.x = MARGEN;
}
