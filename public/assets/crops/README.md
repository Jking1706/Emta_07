# Cultivos originales

Sprites dibujados para este proyecto, sin recursos gráficos de terceros.

## Formato y dirección artística

- SVG rasterizado por el navegador al cargarlo en Phaser; sin fuentes ni imágenes externas.
- Celdas uniformes de **16 × 24 px**, fondo transparente, coordenadas enteras y `shape-rendering="crispEdges"`.
- Punto de apoyo común: **(8, 22)**. El sprite no salta al cambiar de etapa.
- Anchura máxima de 16 px para plantar en tiles contiguos; las hojas pueden sobresalir hacia arriba.
- Luz desde arriba a la izquierda; sombra corta al pie. Contornos cromáticos oscuros, no negro puro.
- Nabo: follaje vertical, hombros malva y raíz marfil. Calabaza: hojas bajas, fruto verde joven y gajos ciruela al madurar.
- Se conserva el filtrado pixel art del juego. No escalar arbitrariamente cada etapa.

## Frames, de izquierda a derecha

| Archivo | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| `pale_turnip_stages.svg` | Brote | Hojas y raíz joven | Cosecha | — |
| `black_pumpkin_stages.svg` | Brote | Enredadera | Fruto joven | Cosecha |

`src/game/data/crops.ts` define `textureKey`, `stageCount` y `growthDays`.
El frame depende de los días de riego procesados, no de los días transcurridos sin agua.
Los sprites no cambian la estructura de los cultivos guardados: su aspecto se reconstruye a partir de `cropId` y `waterCount`.

## Referencia técnica consultada

[Phaser: Textures, spritesheets y frames](https://docs.phaser.io/phaser/concepts/textures).
La documentación confirma el uso de celdas uniformes, el soporte de SVG rasterizado y el cambio de frame sobre una textura compartida.
