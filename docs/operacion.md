# Operación

## Antes de usarlo de verdad

1. **Secretos.** Genere los dos JWT de `apps/api/.env` con
   `openssl rand -hex 32`. Los de `apps/api/.env.example` son marcadores,
   no valen para producción.
2. **Contraseñas.** Cambie la del seed (`Cambiar.2026`) y cree los usuarios
   reales desde Configuración con sus roles.
3. **Datos de la empresa.** Complétalos en Configuración: sin ellos no se
   pueden emitir contratos.
4. **Respaldos.** Programe `infra/scripts/backup.sh` antes del primer día de
   uso, no después.

## Base de datos gestionada

El sistema no depende de Docker: apuntando `DATABASE_URL` a un PostgreSQL
gestionado, la API y el frontend corren directamente con `pnpm dev`.

```bash
pnpm db:deploy      # aplica el esquema completo en la base remota
pnpm db:arranque    # crea el administrador; imprime su clave una vez
```

Dos detalles con proveedores gestionados:

- **`sslmode=require` no significa lo mismo en todas partes.** Prisma lo
  interpreta como libpq —cifrar sin verificar la CA— y conecta con el
  certificado autofirmado que suelen presentar. `node-pg`, en cambio, lo
  trata como verificación completa y lo rechaza: los scripts que usen `pg`
  directamente deben pasar `ssl: { rejectUnauthorized: false }`.
- **Verifique la zona horaria del servidor.** Debe ser UTC. La cadena ya
  fuerza `timezone=UTC` por sesión, que es lo que de verdad importa para
  convertir timestamps a DATE.

Los contratos PDF siguen escribiéndose en disco (`CONTRATOS_DIR`), no en
la base: si el servidor de la API es efímero, móntele un volumen o
súbalos a almacenamiento externo.

## Despliegue en contenedores

```bash
pnpm up:completo     # construye las imágenes y levanta todo
pnpm ps              # estado
pnpm logs            # seguimiento
```

Tres detalles que conviene conocer:

- **Cada contenedor lee el `.env` de su app.** Compose toma las
  credenciales del PostgreSQL de `infra/.env` (lo encuentra solo, junto al
  archivo de compose), la API sus secretos de `apps/api/.env` y la web de
  `apps/web/.env.local`. Sin `apps/api/.env` la API no arranca: le faltan
  los secretos JWT.
- **Los contratos viven en un volumen propio** (`contratos`), porque no
  están en la base de datos: sin él se perderían al recrear el contenedor.
- **Los contenedores corren en UTC** y con un usuario sin privilegios. La
  zona horaria es deliberada: las fechas de negocio son días UTC de punta a
  punta.

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
