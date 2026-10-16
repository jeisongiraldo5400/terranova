import { ETIQUETA_ESTADO_LOTE, dinero, esCero } from '@terranova/shared';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, CardEncabezado, CeldaDoble, Fila, Indicador, Money, Progreso,
  TONO_ESTADO_LOTE, Tabla, Td, Th, Vacio, montoCompacto,
} from '@/components/ui';
import { IconoDinero, IconoMora, IconoPorCobrar, IconoRecaudo } from '@/components/iconos';
import { area, fechaCorta } from '@/lib/formato';

export default async function PaginaTablero() {
  const d = await api.get<Dashboard>('/reportes/dashboard');

  const totalLotes = d.inventario.reduce((t, i) => t + i.cantidad, 0);
  const disponibles = d.inventario.find((i) => i.estado === 'DISPONIBLE')?.cantidad ?? 0;

  // Aritmética exacta: el mismo módulo de dinero que usan la API y la base.
  const vendido = dinero(d.cartera.valor_vendido);
  const recaudado = dinero(d.cartera.recaudado);
  const pctRecaudo = esCero(vendido)
    ? 0
    : Number(recaudado.dividedBy(vendido).times(100).toFixed(1));

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero"
        descripcion="Inventario, cartera y recaudo de todos los proyectos."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          etiqueta="Valor vendido"
          valor={montoCompacto(d.cartera.valor_vendido)}
          detalle={`${d.cartera.ventas} ventas registradas`}
          tono="marca"
          icono={<IconoDinero className="size-5" />}
        />
        <Indicador
          etiqueta="Recaudado"
          valor={montoCompacto(d.cartera.recaudado)}
          detalle={`${pctRecaudo}% de lo vendido`}
          tono="exito"
          icono={<IconoRecaudo className="size-5" />}
        />
        <Indicador
          etiqueta="Por cobrar"
          valor={montoCompacto(d.cartera.por_cobrar)}
          detalle="Saldo pendiente por recaudar"
          tono="alerta"
          icono={<IconoPorCobrar className="size-5" />}
        />
        <Indicador
          etiqueta="En mora"
          valor={montoCompacto(d.cartera.en_mora)}
          detalle={
            d.mora.length > 0
              ? `${d.mora.length} venta(s) vencida(s)`
              : 'Toda la cartera al día'
          }
          tono={Number(d.cartera.en_mora) > 0 ? 'peligro' : 'neutro'}
          icono={<IconoMora className="size-5" />}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* --- Inventario --- */}
        <Card className="lg:col-span-2">
          <CardEncabezado
            titulo="Inventario de lotes"
            descripcion={`${totalLotes} lotes · ${disponibles} disponibles`}
          />
          <div className="space-y-5 p-5">
            {d.inventario.map((i) => (
              <div key={i.estado}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tono={TONO_ESTADO_LOTE[i.estado] ?? 'neutro'} punto>
                    {ETIQUETA_ESTADO_LOTE[i.estado]}
                  </Badge>
                  <span className="tabular text-xs text-muted-500">
                    {i.cantidad} · {area(i.area)}
                  </span>
                </div>
                <Progreso
                  porcentaje={totalLotes ? (i.cantidad / totalLotes) * 100 : 0}
                  tono={TONO_ESTADO_LOTE[i.estado] ?? 'neutro'}
                />
                <p className="mt-1.5 text-right text-xs text-muted-400">
                  <Money valor={i.valor} />
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* --- Recaudo mensual --- */}
        <Card className="lg:col-span-3">
          <CardEncabezado titulo="Recaudo mensual" descripcion="Últimos 12 meses" />
          {d.recaudoMensual.length === 0 ? (
            <Vacio titulo="Sin pagos registrados" descripcion="Aquí aparecerá el recaudo por mes." />
          ) : (
            <div className="p-5">
              <GraficaBarras datos={d.recaudoMensual} />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* --- Mora --- */}
        <Card>
          <CardEncabezado titulo="Cartera en mora" descripcion="Cuotas vencidas sin cubrir" />
          {d.mora.length === 0 ? (
            <Vacio titulo="Sin cartera vencida" descripcion="Todas las cuotas están al día." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Lote</Th>
                  <Th>Cliente</Th>
                  <Th alinear="right">En mora</Th>
                </tr>
              </thead>
              <tbody>
                {d.mora.slice(0, 7).map((m) => (
                  <Fila key={m.venta_id}>
                    <Td>
                      <CeldaDoble principal={m.lote_codigo} secundario={m.proyecto_nombre} mono />
                    </Td>
                    <Td className="max-w-[10rem]">
                      <span className="block truncate">{m.cliente_nombre}</span>
                    </Td>
                    {/* Monto y antigüedad juntos: en una tarjeta estrecha,
                        cuatro columnas obligaban a desplazamiento lateral. */}
                    <Td alinear="right">
                      <Money valor={m.total_en_mora} tono="peligro" className="font-medium" />
                      <span className="tabular mt-0.5 block text-2xs text-danger-500">
                        {m.dias_mora_maximo} días vencida
                      </span>
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Card>

        {/* --- Proximos vencimientos --- */}
        <Card>
          <CardEncabezado
            titulo="Próximos cobros"
            descripcion="Cuotas que vencen en los próximos 30 días"
          />
          {d.proximosVencimientos.length === 0 ? (
            <Vacio titulo="Sin cobros próximos" descripcion="No hay cuotas que venzan este mes." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Lote</Th>
                  <Th>Cliente</Th>
                  <Th alinear="right">Monto y vencimiento</Th>
                </tr>
              </thead>
              <tbody>
                {d.proximosVencimientos.slice(0, 7).map((c, i) => (
                  <Fila key={`${c.venta_id}-${i}`}>
                    <Td>
                      <CeldaDoble principal={c.lote_codigo} secundario={c.proyecto_nombre} mono />
                    </Td>
                    <Td className="max-w-[10rem]">
                      <span className="block truncate">{c.cliente_nombre}</span>
                    </Td>
                    {/* Monto y fecha juntos: en una tarjeta de media pagina,
                        cuatro columnas cortaban el dato mas importante. */}
                    <Td alinear="right">
                      <Money valor={c.monto_pendiente} className="font-medium" />
                      <span className="tabular mt-0.5 block text-2xs text-muted-400">
                        vence {fechaCorta(c.fecha_vencimiento)}
                      </span>
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Card>
      </div>
    </>
  );
}

/**
 * Barras del recaudo mensual en SVG puro, sin dependencias de graficado.
 * El eje empieza en cero y cada barra lleva su valor: una gráfica que no se
 * puede leer con precisión no sirve para decidir cobros.
 */
function GraficaBarras({
  datos,
}: { datos: Array<{ mes: string; recaudado: string; pagos: number }> }) {
  const maximo = Math.max(...datos.map((d) => Number(d.recaudado)), 1);
  const compacto = new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    // items-stretch (por defecto), NO items-end: con items-end cada columna
    // se encoge a su contenido y la altura en % de la barra no resuelve.
    <div className="flex h-56 gap-1.5" role="img" aria-label="Recaudo por mes">
      {datos.map((d) => {
        const alto = (Number(d.recaudado) / maximo) * 100;
        const [anio, mes] = d.mes.split('-');
        return (
          <div key={d.mes} className="group flex min-w-0 flex-1 flex-col gap-2">
            <span className="tabular text-center text-2xs font-medium text-muted-500">
              {compacto.format(Number(d.recaudado))}
            </span>
            <div className="relative min-h-0 flex-1 rounded-t bg-muted-100/60">
              <div
                className="transicion-suave absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-t from-brand-600 to-brand-500 group-hover:from-brand-700 group-hover:to-brand-600"
                style={{ height: `${Math.max(alto, 2)}%` }}
                title={`${d.mes}: ${d.recaudado} (${d.pagos} pagos)`}
              />
            </div>
            <span className="text-center text-2xs text-muted-400">
              {mes}/{anio?.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
