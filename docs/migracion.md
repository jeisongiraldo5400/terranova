# Migración de los datos del sistema anterior

Los datos del v0 viven en el `localStorage` de **cada navegador de cada
equipo**. No hay un servidor del que extraerlos: hay que recogerlos máquina
por máquina.

## 1. Exportar

En cada equipo donde se usó el sistema, con el **mismo navegador**:

1. Abra `tools/migracion-localstorage/src/exportador.html` desde el mismo
   origen donde funcionaba el sistema anterior.
2. Pulse **Descargar datos de este navegador**.
3. Guarde el `terranova-export-AAAA-MM-DD.json` resultante.

Si el sistema se usó en tres computadores, habrá tres archivos y cada uno
puede tener datos distintos.

## 2. Ensayar

```bash
pnpm migrar:legacy --archivo ~/Descargas/terranova-export-2026-10-15.json
```

No escribe nada. Analiza, informa y deja `informe-migracion.json`.

Revise antes de continuar:

- **Clientes duplicados con nombres distintos.** El v0 anidaba los clientes
  por proyecto y no normalizaba la cédula, así que `1.234.567` y `1234567`
  convivían como personas diferentes. El importador los funde por documento
  normalizado y avisa de cada conflicto de nombre.
- **Lotes sin área.** El v0 no tenía ese campo. Se asigna el mínimo de
  1.000 m² y el lote queda marcado en sus observaciones. Hay que corregirlos
  a mano con el plano del proyecto.
- **Ventas reconstruidas.** `pages/Ventas.jsx` nunca escribió la clave
  `ventas`, por lo que la única huella de una venta es el estado del lote y
  su `fechaVenta`. El importador deduce la venta de ahí, toma el precio de
  lista como precio negociado y lo señala. **Verifique precio y plazo con
  los contratos en papel.**
- **Pagos huérfanos.** Pagos que apuntan a lotes inexistentes. Se omiten y
  se listan en el informe.

## 3. Importar

```bash
pnpm migrar:legacy --archivo <export.json> --aplicar
```

Todo lo importado queda a nombre del usuario `migracion@terranova.co`, que
está desactivado y no puede iniciar sesión: existe solo como autor en la
auditoría, para distinguir lo migrado de lo capturado después.

Si hay varios archivos, ejecútelos uno tras otro: el importador usa `upsert`
por documento y por código de lote, de modo que repetir no duplica.

## 4. Verificar

```sql
-- Las cuotas de cada plan deben sumar el precio negociado
SELECT v.numero, v.precio_negociado, sum(c.monto_esperado) AS suma,
       (sum(c.monto_esperado) = v.precio_negociado) AS cuadra
  FROM ventas v
  JOIN planes_pago p ON p.venta_id = v.id
  JOIN cuotas c      ON c.plan_id  = p.id
 GROUP BY v.numero, v.precio_negociado
HAVING sum(c.monto_esperado) <> v.precio_negociado;   -- debe salir vacío

-- Lotes que quedaron con el área o el precio por defecto
SELECT codigo, area_m2, precio_lista, observaciones
  FROM lotes WHERE observaciones IS NOT NULL ORDER BY codigo;
```

Contraste además el total recaudado con los registros contables antes de
dar la migración por buena.

## Lo que no se migra

- **Usuarios y contraseñas.** El v0 tenía `admin`/`1234` en el código; no
  hay nada que conservar. Cree los usuarios desde Configuración.
- **Contratos PDF.** Se generaban en el navegador y no se archivaban.
  Vuelva a emitirlos desde cada venta cuando los necesite.
- **El estado de cartera.** No se importa porque no se almacena: se calcula
  a partir de los pagos.
