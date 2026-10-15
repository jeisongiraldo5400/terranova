# Arquitectura

## Por qué se reescribió

El sistema v0 era un frontend React de una sola capa con `localStorage` como
base de datos. El análisis previo encontró, entre otros:

| Problema | Dónde | Consecuencia |
|---|---|---|
| Las ventas nunca se guardaban | `pages/Ventas.jsx:116` | Pagos y Contratos (2.144 líneas) siempre vacíos |
| `saldo === 0` sobre float | `pages/Pagos.jsx:433` | Ventas que nunca se liquidaban |
| Clientes sin `id` | `ClienteFormulario.jsx:8` | TypeError al intentar vender |
| Dos almacenes de clientes | `storage.js:7` vs `components/` | Datos invisibles entre versiones |
| Sin transacciones ni bloqueo | todo | Doble venta del mismo lote |
| Pagos borrados del arreglo | `pages/Pagos.jsx:395` | Dinero sin rastro |
| `admin` / `1234` en el código | `Login.jsx:22` | Sin autenticación real |
| Sin campo de área | formulario de lotes | La regla de 1000 m² era inaplicable |

No eran errores sueltos: venían de que el estado derivado se almacenaba, de
que no había una frontera donde validar, y de que el navegador era a la vez
interfaz, lógica y base de datos.

## Las capas

```
  Navegador
     │  cookies httpOnly, mismo origen
     ▼
  Next.js (apps/web)          ── proxy /api/* ──┐
     │  Server Components para lectura          │
     │  Zod en los formularios                  │
     ▼                                          ▼
  packages/shared  ◄──── mismas reglas ────  NestJS (apps/api)
     dinero · estados · reglas · permisos       │ guard por permiso
                                                │ transacciones
                                                ▼
                                           PostgreSQL
                                            invariantes, vistas, auditoría
```

La flecha de doble sentido hacia `packages/shared` es lo esencial: el
esquema que valida el formulario es exactamente el que valida el DTO en el
servidor. Una regla nueva se escribe una vez.

## Dónde vive cada regla

Una misma regla puede aparecer en tres niveles, con propósitos distintos:

| Nivel | Propósito | Ejemplo |
|---|---|---|
| Formulario (Zod) | Respuesta inmediata, sin ida y vuelta | «El pago no puede tener fecha futura» |
| Servicio (dominio) | Mensaje con contexto de negocio | «El pago de $200.000.000 excede el saldo de $84.000.000» |
| Base de datos | Garantía que nadie puede esquivar | `CHECK (fecha <= CURRENT_DATE)` |

No es duplicación: el primero es comodidad, el segundo es claridad, el
tercero es integridad. El único que no se puede omitir es el tercero.

## Decisiones

**pnpm en lugar de npm.** pnpm aísla `node_modules`, de modo que un paquete
que no declara una dependencia no la ve. El v0 importaba `jspdf` en
`frontend/` sin declararlo: funcionaba por herencia del `node_modules` raíz
y un `npm install` limpio rompía el build. Con pnpm eso es imposible.

**Prisma en lugar de TypeORM.** Mapea `NUMERIC` a `Decimal` de forma nativa;
con TypeORM habría que gestionar los decimales a mano, que es justo el
camino por el que el v0 perdió exactitud.

**El PDF se genera en el servidor.** En el v0 lo armaba el navegador con
jsPDF y coordenadas a mano: cada equipo producía un documento distinto y no
quedaba copia. Ahora se numera con una secuencia de Postgres, se archiva con
su `sha256` y regenerar crea una versión nueva sin borrar la anterior.

**Las fechas de negocio son días UTC.** Venta, pago y vencimiento son
columnas `DATE`. Toda la cadena —`fechaSchema`, `sumarMeses`, la sesión de
Postgres— trabaja en UTC. Mezclar hora local en un solo punto corría los
vencimientos un día hacia atrás en Colombia (UTC−5); ocurrió dos veces
durante el desarrollo y las dos quedaron cubiertas con tests.

## Modelo de datos

El cambio de fondo respecto al v0:

- **El cliente es global**, no por proyecto. Quien compra en dos proyectos es
  un registro con una cartera consolidada, no dos copias con saldos propios.
- **El lote tiene área**, con un trigger que aplica el mínimo del proyecto.
- **La venta tiene plan de pago** (`PlanPago` + `Cuota`), lo que reconcilia
  el «dos pagos» del documento original con los abonos libres del código. El
  plan por defecto son dos cuotas; admitir N no requiere cambios.
- **Los pagos se anulan, no se borran**, con autor, fecha y motivo obligatorio.
- **Todo movimiento de dinero deja auditoría.**

## Permisos

La matriz vive en `packages/shared/src/domain/permisos.ts`. El guard de Nest
la usa para autorizar y el menú lateral para decidir qué mostrar: una sola
definición, sin posibilidad de que la interfaz y el servidor discrepen.

| | Lotes | Clientes | Ventas | Pagos | Anular | Reportes | Config |
|---|---|---|---|---|---|---|---|
| **Admin** | CRUD | CRUD | CRUD | CRUD | sí | sí | sí |
| **Secretaria** | ver | CRUD | crear | crear | no | sí | no |
| **Empleado** | ver | ver | ver | — | no | ver | no |

Ocultar un botón no es seguridad: el permiso se verifica en la API y la
interfaz solo refleja el resultado.
