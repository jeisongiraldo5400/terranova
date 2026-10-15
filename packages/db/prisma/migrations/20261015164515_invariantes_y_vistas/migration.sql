-- Generado desde prisma/sql/ por infra/scripts/nueva-migracion-sql.sh
-- No editar a mano: modifique los archivos de prisma/sql/ y regenere.

-- ===== 01-invariantes.sql =====
-- ===========================================================================
-- Invariantes de integridad
-- ---------------------------------------------------------------------------
-- Estas reglas tambien estan en packages/shared/src/domain, pero aqui son
-- inviolables: ni un bug en la API, ni una consulta manual, ni el script de
-- migracion pueden dejar la base en un estado invalido.
--
-- El sistema v0 no tenia ninguna. Se podia vender dos veces el mismo lote,
-- registrar pagos negativos y crear lotes de 10 m2.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Un lote no puede tener dos ventas vigentes a la vez.
--
--    Esta es la proteccion contra la doble venta. El v0 solo comprobaba
--    `lote.estado === 'Vendido'` en memoria, sin transaccion: dos usuarios
--    pulsando "Vender" al mismo tiempo creaban dos ventas del mismo lote.
--    Un indice unico parcial lo hace imposible a nivel de motor.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_venta_vigente_por_lote
  ON ventas (lote_id)
  WHERE estado IN ('ACTIVA', 'LIQUIDADA');

-- ---------------------------------------------------------------------------
-- 2. Regla del documento original: el lote minimo es de 1000 m2.
--    Se valida contra el minimo configurado del proyecto mediante trigger,
--    y con un piso absoluto como CHECK.
-- ---------------------------------------------------------------------------
ALTER TABLE lotes
  DROP CONSTRAINT IF EXISTS chk_lote_area_positiva;
ALTER TABLE lotes
  ADD CONSTRAINT chk_lote_area_positiva CHECK (area_m2 > 0);

CREATE OR REPLACE FUNCTION fn_validar_area_lote()
RETURNS TRIGGER AS $$
DECLARE
  v_area_minima NUMERIC(10, 2);
BEGIN
  SELECT area_minima_m2 INTO v_area_minima
    FROM proyectos WHERE id = NEW.proyecto_id;

  IF NEW.area_m2 < v_area_minima THEN
    RAISE EXCEPTION
      'El area del lote (% m2) es menor que el minimo del proyecto (% m2)',
      NEW.area_m2, v_area_minima
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_area_lote ON lotes;
CREATE TRIGGER trg_validar_area_lote
  BEFORE INSERT OR UPDATE OF area_m2, proyecto_id ON lotes
  FOR EACH ROW EXECUTE FUNCTION fn_validar_area_lote();

-- ---------------------------------------------------------------------------
-- 3. El dinero siempre es positivo y coherente.
-- ---------------------------------------------------------------------------
ALTER TABLE lotes DROP CONSTRAINT IF EXISTS chk_lote_precio_positivo;
ALTER TABLE lotes
  ADD CONSTRAINT chk_lote_precio_positivo CHECK (precio_lista > 0);

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS chk_venta_precio_positivo;
ALTER TABLE ventas
  ADD CONSTRAINT chk_venta_precio_positivo CHECK (precio_negociado > 0);

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS chk_pago_monto_positivo;
ALTER TABLE pagos
  ADD CONSTRAINT chk_pago_monto_positivo CHECK (monto > 0);

ALTER TABLE cuotas DROP CONSTRAINT IF EXISTS chk_cuota_monto_positivo;
ALTER TABLE cuotas
  ADD CONSTRAINT chk_cuota_monto_positivo CHECK (monto_esperado > 0);

ALTER TABLE planes_pago DROP CONSTRAINT IF EXISTS chk_plan_montos;
ALTER TABLE planes_pago
  ADD CONSTRAINT chk_plan_montos
  CHECK (cuota_inicial >= 0 AND saldo_financiado >= 0 AND numero_cuotas >= 1);

-- ---------------------------------------------------------------------------
-- 4. Un pago anulado debe tener fecha, autor y motivo. Y al contrario:
--    un pago vigente no puede traer datos de anulacion.
--
--    En el v0 los pagos se eliminaban del arreglo y el dinero desaparecia
--    sin rastro; aqui la anulacion es un registro completo o no existe.
-- ---------------------------------------------------------------------------
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS chk_pago_anulacion_completa;
ALTER TABLE pagos
  ADD CONSTRAINT chk_pago_anulacion_completa CHECK (
    (anulado = FALSE
      AND anulado_en IS NULL
      AND anulado_por_id IS NULL
      AND motivo_anulacion IS NULL)
    OR
    (anulado = TRUE
      AND anulado_en IS NOT NULL
      AND anulado_por_id IS NOT NULL
      AND char_length(trim(motivo_anulacion)) >= 10)
  );

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS chk_venta_anulacion_completa;
ALTER TABLE ventas
  ADD CONSTRAINT chk_venta_anulacion_completa CHECK (
    (estado <> 'ANULADA' AND anulado_en IS NULL)
    OR
    (estado = 'ANULADA'
      AND anulado_en IS NOT NULL
      AND anulado_por_id IS NOT NULL
      AND char_length(trim(motivo_anulacion)) >= 10)
  );

-- ---------------------------------------------------------------------------
-- 5. Ningun pago puede ser anterior a su venta ni posterior a hoy.
--    El v0 aceptaba ambos casos sin chistar.
-- ---------------------------------------------------------------------------
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS chk_pago_no_futuro;
ALTER TABLE pagos
  ADD CONSTRAINT chk_pago_no_futuro CHECK (fecha <= CURRENT_DATE);

CREATE OR REPLACE FUNCTION fn_validar_fecha_pago()
RETURNS TRIGGER AS $$
DECLARE
  v_fecha_venta DATE;
BEGIN
  SELECT fecha_venta INTO v_fecha_venta FROM ventas WHERE id = NEW.venta_id;

  IF NEW.fecha < v_fecha_venta THEN
    RAISE EXCEPTION
      'El pago (%) no puede ser anterior a la fecha de venta (%)',
      NEW.fecha, v_fecha_venta
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_fecha_pago ON pagos;
CREATE TRIGGER trg_validar_fecha_pago
  BEFORE INSERT OR UPDATE OF fecha, venta_id ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_fecha_pago();

-- ---------------------------------------------------------------------------
-- 6. La suma de los pagos vigentes nunca puede superar el precio negociado.
--    El v0 validaba esto solo en el cliente (Pagos.jsx:187), asi que una
--    peticion directa podia sobrepasarlo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_sobrepago()
RETURNS TRIGGER AS $$
DECLARE
  v_precio   NUMERIC(14, 2);
  v_pagado   NUMERIC(14, 2);
BEGIN
  SELECT precio_negociado INTO v_precio FROM ventas WHERE id = NEW.venta_id;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM pagos
   WHERE venta_id = NEW.venta_id
     AND anulado = FALSE
     AND id <> NEW.id;

  IF NEW.anulado = FALSE AND (v_pagado + NEW.monto) > v_precio THEN
    RAISE EXCEPTION
      'El pago excede el saldo pendiente. Precio: %, pagado: %, intento: %',
      v_precio, v_pagado, NEW.monto
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_sobrepago ON pagos;
CREATE TRIGGER trg_validar_sobrepago
  BEFORE INSERT OR UPDATE OF monto, anulado, venta_id ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_sobrepago();

-- ---------------------------------------------------------------------------
-- 7. Las cuotas del plan deben sumar exactamente el precio negociado.
--    Se verifica de forma diferida (al final de la transaccion) porque las
--    cuotas se insertan una por una.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_suma_cuotas()
RETURNS TRIGGER AS $$
DECLARE
  v_precio      NUMERIC(14, 2);
  v_suma_cuotas NUMERIC(14, 2);
  v_plan_id     UUID;
BEGIN
  v_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);

  SELECT v.precio_negociado INTO v_precio
    FROM planes_pago p JOIN ventas v ON v.id = p.venta_id
   WHERE p.id = v_plan_id;

  SELECT COALESCE(SUM(monto_esperado), 0) INTO v_suma_cuotas
    FROM cuotas WHERE plan_id = v_plan_id;

  IF v_suma_cuotas <> v_precio THEN
    RAISE EXCEPTION
      'Las cuotas del plan suman % pero el precio negociado es %',
      v_suma_cuotas, v_precio
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_suma_cuotas ON cuotas;
CREATE CONSTRAINT TRIGGER trg_validar_suma_cuotas
  AFTER INSERT OR UPDATE OR DELETE ON cuotas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_validar_suma_cuotas();

-- ---------------------------------------------------------------------------
-- 8. Busqueda de clientes sin acentos ni mayusculas.
--    "JOSE PEREZ", "Jose Perez" y "José Pérez" deben encontrarse igual.
--
--    Las extensiones y el envoltorio inmutable de unaccent() se crean en la
--    migracion `extensiones`, que debe correr antes: Postgres resuelve el
--    cast ::regdictionary al analizar el lote de sentencias, de modo que la
--    extension tiene que existir ya cuando se analiza esta.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_busqueda
  ON clientes USING gin (
    (lower(inmutable_unaccent(nombre)) || ' ' || documento) gin_trgm_ops
  );

-- Misma normalizacion para buscar lotes por codigo.
CREATE INDEX IF NOT EXISTS idx_lotes_busqueda
  ON lotes USING gin (lower(codigo) gin_trgm_ops);

-- ===== 02-vistas.sql =====
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
  cv.dias_mora_maximo,

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

