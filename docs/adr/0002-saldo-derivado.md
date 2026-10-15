# ADR 0002 · El saldo se calcula, nunca se almacena

**Estado:** aceptado · **Fecha:** 2026-10-15

## Contexto

En el v0 el saldo vivía en tres lugares a la vez: `lote.saldo`,
`cliente.saldo` y `lote.estadoDeuda`. Los escribían funciones distintas
—`actualizarSaldoLote` en `Pagos.jsx:310` y el flujo de venta en
`Ventas.jsx`— sin transacción que las coordinara.

Cualquier fallo a mitad de camino dejaba los tres valores divergentes, y no
existía forma de saber cuál era el correcto: no había una fuente de verdad,
solo tres copias con la misma autoridad.

## Decisión

El saldo es una función pura de `(precio negociado, pagos vigentes)` y no se
persiste en ninguna columna. La fórmula está implementada dos veces, de
forma deliberada:

- `packages/shared/src/domain/cartera.ts`, para la aplicación.
- La vista `venta_estado_cuenta`, para reportes y consultas SQL.

Lo que sí se almacena es el **estado** (`ACTIVA`/`LIQUIDADA`,
`VENDIDO`/`PAGADO`), que se deriva del saldo dentro de la misma transacción
que registra o anula el pago, mediante `sincronizarEstado()`.

## Consecuencias

- No puede haber desacuerdo entre el saldo y los pagos: no hay nada que
  desincronizar.
- Anular un pago recalcula el estado automáticamente; una venta liquidada
  vuelve a `ACTIVA` y el lote de `PAGADO` a `VENDIDO`.
- Se puede consultar la cartera a una fecha de corte pasada, porque el saldo
  es una función del historial y no un campo mutable sin memoria.
- Las dos implementaciones de la fórmula podrían divergir. El riesgo se
  acota con tests de dominio y con que ambas lean los mismos datos; es un
  precio menor frente a tres columnas que ya divergían en producción.
