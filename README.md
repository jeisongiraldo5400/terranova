# TERRANOVA

Sistema de administración de lotes: proyectos, clientes, ventas, cartera y
contratos. Reescritura completa del sistema v0 (React + localStorage) sobre
Next.js, NestJS y PostgreSQL.

---

## Arranque rápido

```bash
cp .env.example .env          # revise los puertos y genere los secretos JWT
pnpm install
pnpm up                       # levanta PostgreSQL (y MinIO) en Docker
pnpm db:deploy                # aplica las migraciones
pnpm db:seed                  # datos de demostración
pnpm dev                      # API en :3101, web en :3100
```

Ingreso de demostración: `admin@terranova.co` / `Cambiar.2026`
(los tres roles usan la misma clave; cámbiela antes de usarlo de verdad).

Documentación de la API: <http://localhost:3101/api/docs>

> Los puertos 3100/3101 se eligieron porque 3000/3001 estaban ocupados en el
> equipo de desarrollo. Si en el suyo están libres, ajústelos en `.env`.

---

## Estructura

```
terranova/
├── apps/
│   ├── api/      NestJS: autenticación, casos de uso, contratos PDF
│   └── web/      Next.js App Router: las 9 pantallas del sistema
├── packages/
│   ├── shared/   dominio, dinero exacto, reglas y esquemas Zod   ← el núcleo
│   ├── db/       Prisma: esquema, migraciones, vistas SQL, seed
│   ├── ui/       componentes compartidos
│   └── config/   presets de TypeScript y tokens de diseño
├── tools/
│   └── migracion-localstorage/   exportador e importador de los datos v0
├── infra/        Docker Compose, respaldos, scripts de operación
├── docs/         documentación y decisiones de arquitectura
└── legacy/       sistema v0, como referencia durante la migración
```

`packages/shared` es la pieza que sostiene todo lo demás: una regla escrita
allí se aplica igual en la API, en el formulario del navegador y en el
importador de datos. En el v0 las validaciones estaban duplicadas entre
`pages/` y `components/`, con lógica que ya había divergido.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | API y web en modo desarrollo |
| `pnpm build` | Compila todo respetando el grafo de dependencias |
| `pnpm test` | Tests de dominio |
| `pnpm typecheck` | Verificación de tipos en todos los paquetes |
| `pnpm db:deploy` | Aplica migraciones pendientes |
| `pnpm db:seed` | Siembra datos de demostración |
| `pnpm db:studio` | Explorador visual de la base |
| `pnpm up` / `pnpm down` | Levanta o detiene los contenedores |
| `pnpm migrar:legacy --archivo <json>` | Importa los datos del sistema anterior |
| `pnpm verificar:rutas` | Guardas de mayúsculas y caracteres en rutas |
| `./infra/scripts/backup.sh` | Respaldo de la base y de los contratos |
| `./infra/scripts/api-local.sh start\|stop\|restart` | API compilada en segundo plano |

---

## Tres decisiones que explican el resto

**El dinero nunca es un número de punto flotante.** Es `Decimal` en el
código y `NUMERIC(14,2)` en Postgres. El bug más costoso del v0 vivía en
`Pagos.jsx:433`: `if (saldo === 0)` sobre un float, de modo que una venta con
residuo decimal nunca se marcaba como pagada. Ver `packages/shared/src/domain/dinero.ts`.

**El saldo se calcula, nunca se almacena.** Es una función de (precio
negociado, pagos vigentes), implementada dos veces con la misma fórmula: en
`cartera.ts` para la aplicación y en la vista `venta_estado_cuenta` para los
reportes. El v0 lo guardaba en tres columnas distintas que podían divergir.

**Las invariantes críticas viven en la base de datos.** Un índice único
parcial impide vender dos veces el mismo lote; los triggers rechazan áreas
por debajo del mínimo, sobrepagos y pagos con fechas imposibles. El código
valida primero para dar buenos mensajes, pero la base es la que no se puede
esquivar. Ver `packages/db/prisma/sql/`.

---

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — cómo está armado y por qué
- [`docs/migracion.md`](docs/migracion.md) — cómo traer los datos del v0
- [`docs/operacion.md`](docs/operacion.md) — despliegue, respaldos, incidentes
- [`docs/Proyecto-v0.md`](docs/Proyecto-v0.md) — documento original del negocio
