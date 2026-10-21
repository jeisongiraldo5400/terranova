# TERRANOVA

Sistema de administración de lotes: proyectos, clientes, ventas, cartera y
contratos. Reescritura completa del sistema v0 (React + localStorage) sobre
Next.js, NestJS y PostgreSQL.

---

## Arranque rápido

```bash
cp apps/api/.env.example apps/api/.env        # base y secretos JWT
cp apps/web/.env.example apps/web/.env.local  # URL de la API
cp packages/db/.env.example packages/db/.env  # base para migraciones y seed
cp infra/.env.example infra/.env              # solo si usa el PostgreSQL de Docker
pnpm install
pnpm up                       # PostgreSQL local en Docker (opcional)
pnpm db:deploy                # aplica las migraciones
pnpm db:arranque              # crea el administrador; muestra su clave una vez
pnpm dev                      # API en :3101, web en :3100
```

Cada app tiene su propio `.env` con solo las variables que usa:

| Archivo               | Lo lee                                  | Contiene                                       |
| --------------------- | --------------------------------------- | ---------------------------------------------- |
| `apps/api/.env`       | API, pruebas e2e                        | `DATABASE_URL`, JWT, `CORS_ORIGIN`, puerto     |
| `apps/web/.env.local` | Next.js                                 | `API_URL`                                      |
| `packages/db/.env`    | Prisma, seed, importador legacy         | `DATABASE_URL`, usuario administrador inicial  |
| `infra/.env`          | Docker Compose, respaldos               | credenciales del PostgreSQL local              |

`DATABASE_URL` aparece en dos archivos porque la API y las migraciones son
procesos distintos; deben apuntar a la misma base. En Railway cada servicio
tiene sus propias variables, así que la separación es la misma: la API
recibe las de `apps/api/.env` y la web las de `apps/web/.env.local`.

Con una base gestionada (Railway, Neon, RDS) basta apuntar `DATABASE_URL`
a ella y omitir `pnpm up`: Docker deja de hacer falta por completo.

Para recorrer el sistema con cifras, `pnpm db:ejemplos` agrega cuatro
proyectos, 50 lotes, 12 clientes y 14 ventas que cubren los cuatro estados
de cartera. **No borra nada**, así que puede correrse sobre una base que ya
tiene información, y repetirse sin duplicar.

`pnpm db:seed` también siembra datos, pero **borra todo lo que haya antes**:
sirve para empezar de cero en desarrollo, no para una instalación real.

`pnpm db:arranque` imprime la clave del administrador una sola vez y no la
guarda en ningún archivo. Con `pnpm db:seed` el ingreso de demostración es
`admin@terranova.co` / `Cambiar.2026`.

Para ver la pila completa en contenedores, tal como se desplegaría:

```bash
pnpm up:completo
```

Documentación de la API: <http://localhost:3101/api/docs>

> Los puertos 3100/3101 se eligieron porque 3000/3001 estaban ocupados en el
> equipo de desarrollo. Si en el suyo están libres, ajústelos en `apps/api/.env`
> (`API_PORT`, `CORS_ORIGIN`) y `apps/web/.env.local` (`API_URL`).

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
│   └── config/   presets de TypeScript y ESLint, tokens de diseño
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
| `pnpm db:arranque` | Crea el administrador y la ficha de empresa; no borra nada |
| `pnpm db:ejemplos` | Agrega un escenario de ejemplo completo; no borra nada |
| `pnpm db:seed` | Siembra datos de demostración (**borra lo existente**) |
| `pnpm db:studio` | Explorador visual de la base |
| `pnpm up` / `pnpm down` | Levanta o detiene PostgreSQL |
| `pnpm up:completo` | Levanta la pila entera en contenedores (API y web incluidas) |
| `pnpm lint` | ESLint en los siete paquetes |
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

## Qué se puede hacer

Todas las operaciones tienen pantalla; nada queda solo en la API.

| Módulo | Operaciones |
|---|---|
| **Proyectos** | crear, editar, añadir etapas, eliminar; resumen de inventario y cartera |
| **Lotes** | crear uno o una manzana completa por rango, editar, eliminar, filtrar |
| **Clientes** | crear, editar, desactivar o reactivar; ficha con cartera consolidada |
| **Ventas** | registrar con vista previa del plan de pago, anular con motivo |
| **Pagos** | registrar abonos, anular con motivo (nunca se borran) |
| **Contratos** | generar, versionar y descargar el PDF verificando su huella |
| **Reportes** | cartera, recaudo, inventario y proyección; exportación a CSV |
| **Auditoría** | quién hizo qué, cuándo, y con qué valores antes y después |
| **Configuración** | datos de la empresa, usuarios, roles y restablecimiento de clave |

Los permisos se aplican en la API, no solo en la interfaz: un empleado que
construya la petición a mano recibe 403 igual.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — cómo está armado y por qué
- [`docs/migracion.md`](docs/migracion.md) — cómo traer los datos del v0
- [`docs/operacion.md`](docs/operacion.md) — despliegue, respaldos, incidentes
- [`docs/Proyecto-v0.md`](docs/Proyecto-v0.md) — documento original del negocio
