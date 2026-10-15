# ADR 0001 · El dinero es decimal exacto, nunca punto flotante

**Estado:** aceptado · **Fecha:** 2026-10-15

## Contexto

El sistema v0 operaba el dinero con `number` de JavaScript. En
`pages/Pagos.jsx:433` decidía si una venta estaba pagada así:

```js
const saldo = precio - pagado;
if (saldo === 0) return 'PAGADO';
```

Con punto flotante binario esa comparación falla para valores que no son
representables de forma exacta. Un lote de 85.000.000 con tres abonos deja
un residuo del orden de 1e-8: el saldo nunca es exactamente cero, la venta
nunca se liquida y la cartera reporta un saldo fantasma indefinidamente.

## Decisión

Todo el dinero del sistema es decimal exacto de extremo a extremo:

- `NUMERIC(14,2)` en PostgreSQL.
- `Prisma.Decimal` (decimal.js) al leer y escribir.
- `Dinero` (decimal.js) en el dominio compartido.
- `string` canónico `"0.00"` en el transporte JSON.

En ningún punto del recorrido aparece un `number` de punto flotante. El
interceptor de serialización convierte `Decimal` a string, nunca a número.

Las comparaciones usan funciones explícitas (`esCero`, `esIgual`,
`esMayor`), no operadores. `aNumero()` existe solo para gráficas y está
documentado como inseguro para cálculos.

## Consecuencias

- Los montos viajan como texto en la API; el cliente nunca los convierte.
- `repartir()` distribuye el residuo del redondeo, de modo que las cuotas
  de un plan suman exactamente el precio. Un trigger diferido lo verifica.
- Hay dos parsers distintos: `dinero()` estricto para formato canónico y
  `dineroDesdeTexto()` para la convención colombiana. Separarlos elimina la
  ambigüedad de «10.005», que puede ser diez mil cinco o diez con cinco
  milésimas: la función elegida declara la convención en lugar de adivinar.
