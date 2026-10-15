-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'SECRETARIA', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('ACTIVO', 'PAUSADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'PAGADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('ACTIVA', 'LIQUIDADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('CUOTA_INICIAL', 'ABONO', 'PAGO_FINAL');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'CONSIGNACION');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'CE', 'NIT', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "ModalidadPlan" AS ENUM ('DOS_PAGOS', 'CUOTAS');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado_en" TIMESTAMP(3),
    "user_agent" VARCHAR(300),
    "ip" VARCHAR(45),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "ubicacion" VARCHAR(200),
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'ACTIVO',
    "area_minima_m2" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "observaciones" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "etapa_id" UUID,
    "codigo" VARCHAR(30) NOT NULL,
    "area_m2" DECIMAL(10,2) NOT NULL,
    "precio_lista" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'DISPONIBLE',
    "observaciones" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'CC',
    "documento" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "email" VARCHAR(160),
    "direccion" VARCHAR(200),
    "ciudad" VARCHAR(80),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "lote_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "precio_negociado" DECIMAL(14,2) NOT NULL,
    "fecha_venta" DATE NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'ACTIVA',
    "observaciones" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "anulado_en" TIMESTAMP(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_pago" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "modalidad" "ModalidadPlan" NOT NULL,
    "cuota_inicial" DECIMAL(14,2) NOT NULL,
    "saldo_financiado" DECIMAL(14,2) NOT NULL,
    "numero_cuotas" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuotas" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoPago" NOT NULL,
    "monto_esperado" DECIMAL(14,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "descripcion" VARCHAR(80) NOT NULL,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "cuota_id" UUID,
    "tipo" "TipoPago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "referencia" VARCHAR(60),
    "concepto" VARCHAR(200),
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anulado_en" TIMESTAMP(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storage_key" VARCHAR(300) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "datos_snapshot" JSONB NOT NULL,
    "generado_por_id" UUID NOT NULL,
    "generado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_empresa" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "razon_social" VARCHAR(160) NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "direccion" VARCHAR(200) NOT NULL,
    "ciudad" VARCHAR(80) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "representante_legal" VARCHAR(120) NOT NULL,
    "documento_representante" VARCHAR(20) NOT NULL,
    "clausulas_contrato" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" VARCHAR(64),
    "antes" JSONB,
    "despues" JSONB,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_activo_idx" ON "usuarios"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuario_id_revocado_en_idx" ON "refresh_tokens"("usuario_id", "revocado_en");

-- CreateIndex
CREATE INDEX "refresh_tokens_expira_en_idx" ON "refresh_tokens"("expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_proyecto_id_numero_key" ON "etapas"("proyecto_id", "numero");

-- CreateIndex
CREATE INDEX "lotes_proyecto_id_estado_idx" ON "lotes"("proyecto_id", "estado");

-- CreateIndex
CREATE INDEX "lotes_estado_idx" ON "lotes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_proyecto_id_codigo_key" ON "lotes"("proyecto_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes"("nombre");

-- CreateIndex
CREATE INDEX "clientes_activo_idx" ON "clientes"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_numero_key" ON "ventas"("numero");

-- CreateIndex
CREATE INDEX "ventas_lote_id_idx" ON "ventas"("lote_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE UNIQUE INDEX "planes_pago_venta_id_key" ON "planes_pago"("venta_id");

-- CreateIndex
CREATE INDEX "cuotas_fecha_vencimiento_idx" ON "cuotas"("fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_plan_id_numero_key" ON "cuotas"("plan_id", "numero");

-- CreateIndex
CREATE INDEX "pagos_venta_id_anulado_idx" ON "pagos"("venta_id", "anulado");

-- CreateIndex
CREATE INDEX "pagos_fecha_idx" ON "pagos"("fecha");

-- CreateIndex
CREATE INDEX "pagos_cuota_id_idx" ON "pagos"("cuota_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_venta_id_idx" ON "contratos"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_venta_id_version_key" ON "contratos"("venta_id", "version");

-- CreateIndex
CREATE INDEX "audit_log_entidad_entidad_id_idx" ON "audit_log"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_creado_en_idx" ON "audit_log"("creado_en");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuota_id_fkey" FOREIGN KEY ("cuota_id") REFERENCES "cuotas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_generado_por_id_fkey" FOREIGN KEY ("generado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
