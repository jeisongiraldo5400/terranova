# Operación

## Antes de usarlo de verdad

1. **Secretos.** Genere los dos del `.env` con `openssl rand -hex 32`.
   Los del `.env.example` son marcadores, no valen para producción.
2. **Contraseñas.** Cambie la del seed (`Cambiar.2026`) y cree los usuarios
   reales desde Configuración con sus roles.
3. **Datos de la empresa.** Complétalos en Configuración: sin ellos no se
   pueden emitir contratos.
4. **Respaldos.** Programe `infra/scripts/backup.sh` antes del primer día de
   uso, no después.

## Respaldos

```bash
./infra/scripts/backup.sh                    # manual
crontab -e                                   # programado
#   0 1 * * * /ruta/terranova/infra/scripts/backup.sh >> /var/log/terranova-backup.log 2>&1
```

Respalda la base y los contratos PDF (que no viven en la base), verifica que
el archivo comprimido no esté corrupto y rota los de más de 30 días.

Restaurar pide confirmación escrita porque sobreescribe:

```bash
./infra/scripts/restaurar.sh infra/backups/terranova-20261015-010000.sql.gz
```

**Un respaldo que nunca se restauró no es un respaldo.** Pruebe la
restauración sobre una base de ensayo al menos una vez por trimestre.

## Migraciones

```bash
pnpm db:deploy     # aplica las pendientes; es lo que corre en el servidor
```

Para cambiar invariantes o vistas, edite `packages/db/prisma/sql/` y luego:

```bash
./infra/scripts/nueva-migracion-sql.sh descripcion_del_cambio
pnpm db:deploy
```

El script congela el SQL en una migración versionada, de modo que el archivo
de referencia y lo aplicado no se separan.

`prisma migrate reset` **destruye todos los datos**. Prisma pide
confirmación explícita; no la automatice.

## Incidentes frecuentes

**«El pago excede el saldo pendiente»** — La venta ya está cubierta. Si el
cliente pagó de más, el excedente se gestiona aparte; no fuerce el registro.

**«Este lote ya tiene una venta vigente»** — Alguien más lo vendió primero.
Es el índice único parcial haciendo su trabajo. Anule la venta anterior si
corresponde.

**«Las cuotas del plan suman X pero el precio negociado es Y»** — Un error
de programación, no de captura. El trigger diferido impidió guardar un plan
que no cuadra. Repórtelo.

**«El archivo del contrato no coincide con su huella registrada»** — El PDF
archivado se modificó después de emitirse. No se entrega. Regenere el
contrato y averigüe qué pasó con el archivo.

**La API no arranca: `EADDRINUSE`** — Otro proceso ocupa el puerto. Búsquelo
con `lsof -nP -iTCP:3101 -sTCP:LISTEN` antes de matar nada: puede ser otro
proyecto. `./infra/scripts/api-local.sh` identifica el proceso por puerto
justamente por esto.

**Falta un archivo en `dist` tras compilar** — Caché incremental de
TypeScript desactualizada. El `tsBuildInfoFile` apunta dentro de `dist` para
que `deleteOutDir` lo borre junto con la salida; si aun así ocurre,
`rm -rf dist *.tsbuildinfo` y recompile.

## Salud

```bash
curl http://localhost:3101/api/salud
# {"estado":"ok","baseDatos":"conectada","latenciaMs":6,...}
```

Devuelve 200 solo si la base responde; sirve como sonda de disponibilidad.

## Auditoría

Toda operación que mueve dinero o cambia un estado queda registrada con
autor, momento y valores antes/después. Consúltela en Reportes → Auditoría
o directamente:

```sql
SELECT creado_en, accion, entidad, entidad_id, despues
  FROM audit_log ORDER BY creado_en DESC LIMIT 50;
```

Es lo primero que hay que mirar cuando alguien pregunta «¿quién borró este
pago?» — una pregunta que en el sistema anterior no tenía respuesta posible.
