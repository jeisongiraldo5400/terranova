-- ===========================================================================
-- Vistas de cartera
-- ---------------------------------------------------------------------------
-- EL SALDO NO SE ALMACENA. Esta vista es la unica fuente de verdad, en la
-- base y en los reportes; packages/shared/src/domain/cartera.ts implementa
-- la misma formula para la API y la UI.
--
-- En el v0 el saldo vivia en tres columnas distintas (lote.saldo,
-- cliente.saldo, lote.estadoDeuda), escritas por funciones separadas que
-- podian divergir. No habia forma de saber cual era la correcta.
-- ===========================================================================

CREATE OR REPLACE VIEW venta_estado_cuenta AS
SELECT
  v.id                        AS venta_id,
  v.numero                    AS venta_numero,
  v.estado                    AS estado_venta,
  v.fecha_venta,
  v.precio_negociado,
  l.id                        AS lote_id,
  l.codigo                    AS lote_codigo,
  l.area_m2,
  l.proyecto_id,
  p.codigo                    AS proyecto_codigo,
  p.nombre                    AS proyecto_nombre,
  c.id                        AS cliente_id,
  c.documento                 AS cliente_documento,
  c.nombre                    AS cliente_nombre,

  -- Solo los pagos vigentes cuentan. La exclusion de los anulados ocurre
  -- aqui, en un unico lugar.
  COALESCE(pg.total_pagado, 0)                        AS total_pagado,
  GREATEST(v.precio_negociado - COALESCE(pg.total_pagado, 0), 0) AS saldo,
  -- Lo pagado por encima del precio. Normalmente cero.
  GREATEST(COALESCE(pg.total_pagado, 0) - v.precio_negociado, 0) AS excedente,
  COALESCE(pg.cantidad_pagos, 0)                      AS cantidad_pagos,
  pg.ultimo_pago,

  ROUND(
    CASE WHEN v.precio_negociado = 0 THEN 100
         ELSE COALESCE(pg.total_pagado, 0) * 100 / v.precio_negociado
    END, 2
  ) AS porcentaje_pagado,

  -- Monto de las cuotas ya vencidas que el total pagado no alcanza a cubrir.
  GREATEST(COALESCE(cv.vencido, 0) - COALESCE(pg.total_pagado, 0), 0) AS total_en_mora,

  -- Dias de mora SOLO si realmente hay mora. cv.dias_mora_maximo mide la
  -- antiguedad de la cuota vencida mas vieja sin mirar si esta cubierta,
  -- de modo que una venta pagada por completo reportaba "268 dias".
  CASE
    WHEN GREATEST(COALESCE(cv.vencido, 0) - COALESCE(pg.total_pagado, 0), 0) > 0
      THEN cv.dias_mora_maximo
    ELSE NULL
  END AS dias_mora_maximo,

  -- La clasificacion que en el v0 era `saldo === 0` sobre un float.
  CASE
    WHEN v.estado = 'ANULADA' THEN 'ANULADA'
    WHEN v.precio_negociado - COALESCE(pg.total_pagado, 0) <= 0 THEN 'PAGADO'
    WHEN COALESCE(cv.vencido, 0) - COALESCE(pg.total_pagado, 0) > 0 THEN 'EN_MORA'
    WHEN COALESCE(pg.total_pagado, 0) > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
  END AS estado_cartera

FROM ventas v
JOIN lotes     l ON l.id = v.lote_id
JOIN proyectos p ON p.id = l.proyecto_id
JOIN clientes  c ON c.id = v.cliente_id

LEFT JOIN (
  SELECT venta_id,
         SUM(monto)  AS total_pagado,
         COUNT(*)    AS cantidad_pagos,
         MAX(fecha)  AS ultimo_pago
    FROM pagos
   WHERE anulado = FALSE
   GROUP BY venta_id
) pg ON pg.venta_id = v.id

LEFT JOIN (
  SELECT pp.venta_id,
         SUM(cu.monto_esperado) AS vencido,
         MAX(CURRENT_DATE - cu.fecha_vencimiento) AS dias_mora_maximo
    FROM planes_pago pp
    JOIN cuotas cu ON cu.plan_id = pp.id
   WHERE cu.fecha_vencimiento < CURRENT_DATE
   GROUP BY pp.venta_id
) cv ON cv.venta_id = v.id;

COMMENT ON VIEW venta_estado_cuenta IS
  'Estado de cuenta por venta. El saldo se calcula, nunca se almacena.';

-- ---------------------------------------------------------------------------
-- Cartera agregada por proyecto. Alimenta el dashboard, que en el v0 leia
-- los lotes con la forma equivocada (Dashboard.jsx:73 trataba un arreglo
-- como objeto).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW proyecto_resumen AS
SELECT
  p.id                AS proyecto_id,
  p.codigo,
  p.nombre,
  p.estado,

  COUNT(DISTINCT l.id)                                             AS total_lotes,
  COUNT(DISTINCT l.id) FILTER (WHERE l.estado = 'DISPONIBLE')      AS lotes_disponibles,
  COUNT(DISTINCT l.id) FILTER (WHERE l.estado = 'RESERVADO')       AS lotes_reservados,
  COUNT(DISTINCT l.id) FILTER (WHERE l.estado = 'VENDIDO')         AS lotes_vendidos,
  COUNT(DISTINCT l.id) FILTER (WHERE l.estado = 'PAGADO')          AS lotes_pagados,

  COALESCE(SUM(l.area_m2), 0)                                      AS area_total_m2,
  COALESCE(SUM(l.precio_lista) FILTER (WHERE l.estado = 'DISPONIBLE'), 0)
                                                                   AS valor_inventario,

  COALESCE(SUM(ec.precio_negociado), 0)                            AS valor_vendido,
  COALESCE(SUM(ec.total_pagado), 0)                                AS recaudado,
  COALESCE(SUM(ec.saldo), 0)                                       AS por_cobrar,
  COALESCE(SUM(ec.total_en_mora), 0)                               AS en_mora,

  COUNT(DISTINCT ec.venta_id)                                      AS total_ventas,
  COUNT(DISTINCT ec.venta_id) FILTER (WHERE ec.estado_cartera = 'PAGADO')   AS ventas_pagadas,
  COUNT(DISTINCT ec.venta_id) FILTER (WHERE ec.estado_cartera = 'EN_MORA')  AS ventas_en_mora,
  COUNT(DISTINCT ec.cliente_id)                                    AS total_clientes

FROM proyectos p
LEFT JOIN lotes l ON l.proyecto_id = p.id
LEFT JOIN venta_estado_cuenta ec
       ON ec.lote_id = l.id AND ec.estado_venta <> 'ANULADA'
GROUP BY p.id, p.codigo, p.nombre, p.estado;

-- ---------------------------------------------------------------------------
-- Detalle de cuotas con su estado de cobro. Base del reporte de cartera por
-- vencimiento y de la proyeccion de recaudo -- el modulo Reportes del v0
-- eran 4 lineas con solo el titulo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW cuota_estado AS
WITH imputacion AS (
  -- Imputa lo pagado a las cuotas en orden de vencimiento, como en
  -- cualquier cartera: la suma acumulada hasta la cuota anterior indica
  -- cuanto quedaba disponible al llegar a esta.
  SELECT
    cu.id,
    cu.plan_id,
    pp.venta_id,
    cu.numero,
    cu.tipo,
    cu.monto_esperado,
    cu.fecha_vencimiento,
    cu.descripcion,
    COALESCE(SUM(cu.monto_esperado) OVER (
      PARTITION BY cu.plan_id
      ORDER BY cu.fecha_vencimiento, cu.numero
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS acumulado_anterior
  FROM cuotas cu
  JOIN planes_pago pp ON pp.id = cu.plan_id
)
SELECT
  i.id AS cuota_id,
  i.venta_id,
  i.numero,
  i.tipo,
  i.monto_esperado,
  i.fecha_vencimiento,
  i.descripcion,

  LEAST(
    GREATEST(COALESCE(pg.total_pagado, 0) - i.acumulado_anterior, 0),
    i.monto_esperado
  ) AS monto_cubierto,

  i.monto_esperado - LEAST(
    GREATEST(COALESCE(pg.total_pagado, 0) - i.acumulado_anterior, 0),
    i.monto_esperado
  ) AS monto_pendiente,

  CASE
    WHEN LEAST(GREATEST(COALESCE(pg.total_pagado, 0) - i.acumulado_anterior, 0),
               i.monto_esperado) >= i.monto_esperado THEN 'PAGADA'
    WHEN i.fecha_vencimiento < CURRENT_DATE THEN 'EN_MORA'
    WHEN LEAST(GREATEST(COALESCE(pg.total_pagado, 0) - i.acumulado_anterior, 0),
               i.monto_esperado) > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
  END AS estado,

  GREATEST(CURRENT_DATE - i.fecha_vencimiento, 0) AS dias_vencida

FROM imputacion i
LEFT JOIN (
  SELECT venta_id, SUM(monto) AS total_pagado
    FROM pagos WHERE anulado = FALSE GROUP BY venta_id
) pg ON pg.venta_id = i.venta_id;
