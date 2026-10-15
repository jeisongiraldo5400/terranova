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

  -- El plan ya no existe: se esta eliminando la venta completa (o el plan)
  -- en esta misma transaccion, y sus cuotas caen por cascada. No hay nada
  -- que cuadrar. Sin esta salida, borrar una venta disparaba
  -- "las cuotas del plan suman 0.00".
  IF v_precio IS NULL THEN
    RETURN NULL;
  END IF;

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
