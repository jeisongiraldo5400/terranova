import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, CardEncabezado, Indicador, Money, Progreso, Tabla, Td, Th, TONO_ESTADO_LOTE, Vacio,
} from '@/components/ui';
import { area, fechaCorta } from '@/lib/formato';
import { ETIQUETA_ESTADO_LOTE, dinero, esCero, restar } from '@terranova/shared';

export default async function PaginaTablero() {
  const d = await api.get<Dashboard>('/reportes/dashboard');

  const totalLotes = d.inventario.reduce((t, i) => t + i.cantidad, 0);
  const disponibles = d.inventario.find((i) => i.estado === 'DISPONIBLE')?.cantidad ?? 0;

  // Porcentaje recaudado sobre lo vendido. Aritmetica exacta: el calculo
  // usa el mismo modulo de dinero que la API y la base.
  const vendido = dinero(d.cartera.valor_vendido);
  const recaudado = dinero(d.cartera.recaudado);
  const pctRecaudo = esCero(vendido)
    ? 0
    : Number(recaudado.dividedBy(vendido).times(100).toFixed(1));

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero"
        descripcion="Inventario, cartera y recaudo de todos los proyectos"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          etiqueta="Valor vendido"
          valor={new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
          }).format(Number(d.cartera.valor_vendido))}
          detalle={`${d.cartera.ventas} venta(s)`}
          tono="marca"
        />
        <Indicador
          etiqueta="Recaudado"
          valor={new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
          }).format(Number(d.cartera.recaudado))}
          detalle={`${pctRecaudo}% de lo vendido`}
          tono="exito"
        />
        <Indicador
          etiqueta="Por cobrar"
          valor={new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
          }).format(Number(d.cartera.por_cobrar))}
          tono="alerta"
        />
        <Indicador
          etiqueta="En mora"
          valor={new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
          }).format(Number(d.cartera.en_mora))}
          detalle={`${d.mora.length} venta(s) vencida(s)`}
          tono={Number(d.cartera.en_mora) > 0 ? 'peligro' : 'neutro'}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* --- Inventario --- */}
        <Card className="lg:col-span-2">
          <CardEncabezado
            titulo="Inventario de lotes"
            descripcion={`${totalLotes} lotes · ${disponibles} disponibles`}
          />
          <div className="space-y-4 p-5">
            {d.inventario.map((i) => (
              <div key={i.estado}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <Badge tono={TONO_ESTADO_LOTE[i.estado] ?? 'neutro'}>
                    {ETIQUETA_ESTADO_LOTE[i.estado]}
                  </Badge>
                  <span className="tabular text-muted-600">
                    {i.cantidad} · {area(i.area)}
                  </span>
                </div>
                <Progreso
                  porcentaje={totalLotes ? (i.cantidad / totalLotes) * 100 : 0}
                  tono={TONO_ESTADO_LOTE[i.estado] ?? 'neutro'}
                />
                <p className="tabular mt-1 text-right text-xs text-muted-500">
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
          <CardEncabezado
            titulo="Cartera en mora"
            descripcion="Cuotas vencidas sin cubrir"
          />
          {d.mora.length === 0 ? (
            <Vacio titulo="Sin cartera vencida" descripcion="Todas las cuotas están al día." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Lote</Th>
                  <Th>Cliente</Th>
                  <Th alinear="right">En mora</Th>
                  <Th alinear="right">Días</Th>
                </tr>
              </thead>
              <tbody>
                {d.mora.slice(0, 8).map((m) => (
                  <tr key={m.venta_id} className="hover:bg-muted-100">
                    <Td className="font-medium">{m.lote_codigo}</Td>
                    <Td className="max-w-[12rem] truncate">{m.cliente_nombre}</Td>
                    <Td alinear="right">
                      <Money valor={m.total_en_mora} tono="peligro" />
                    </Td>
                    <Td alinear="right" className="tabular">
                      {m.dias_mora_maximo}
                    </Td>
                  </tr>
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
                  <Th>Vence</Th>
                  <Th>Lote</Th>
                  <Th>Cliente</Th>
                  <Th alinear="right">Monto</Th>
                </tr>
              </thead>
              <tbody>
                {d.proximosVencimientos.slice(0, 8).map((c, i) => (
                  <tr key={`${c.venta_id}-${i}`} className="hover:bg-muted-100">
                    <Td className="tabular whitespace-nowrap">{fechaCorta(c.fecha_vencimiento)}</Td>
                    <Td className="font-medium">{c.lote_codigo}</Td>
                    <Td className="max-w-[10rem] truncate">{c.cliente_nombre}</Td>
                    <Td alinear="right">
                      <Money valor={c.monto_pendiente} />
                    </Td>
                  </tr>
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
 * Barras del recaudo mensual en SVG, sin dependencias de graficado.
 * El eje empieza en cero y las barras se etiquetan: una grafica que no
 * se puede leer con precision no sirve para decidir cobros.
 */
function GraficaBarras({ datos }: { datos: Array<{ mes: string; recaudado: string; pagos: number }> }) {
  const maximo = Math.max(...datos.map((d) => Number(d.recaudado)), 1);
  const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

  return (
    // items-stretch (por defecto), NO items-end: con items-end cada columna
    // se encoge a su contenido, queda sin altura y la barra en % colapsa.
    <div className="flex h-56 gap-2" role="img" aria-label="Recaudo por mes">
      {datos.map((d) => {
        const alto = (Number(d.recaudado) / maximo) * 100;
        const [anio, mes] = d.mes.split('-');
        return (
          <div key={d.mes} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="tabular text-center text-[10px] font-medium text-muted-600">
              {compacto.format(Number(d.recaudado))}
            </span>
            <div className="relative min-h-0 flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t bg-brand-600"
                style={{ height: `${Math.max(alto, 2)}%` }}
                title={`${d.mes}: ${d.recaudado} (${d.pagos} pagos)`}
              />
            </div>
            <span className="text-center text-[10px] text-muted-500">
              {mes}/{anio?.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
