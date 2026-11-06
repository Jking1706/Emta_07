# Iteraciones de desarrollo

## Interfaz e interacción

- `UIScene` se inicia en paralelo desde `PreloadScene`; HUD, hotbar, tooltips y paneles usan una cámara independiente.
- `UIScene.consumeInteraction()` entrega una pulsación de E al mundo activo. Los diálogos consumen esa misma pulsación; las repeticiones del teclado se descartan.
- `InteractionResolver` elige la distancia menor y utiliza la prioridad solo en empates. El candidato elegido define tanto el aviso como la acción.
- Teclas 1–8: acceso rápido; I: inventario; J: objetivos/encargos; M: sonido.

## Agricultura e inventario

- Inventario portátil de 24 espacios, de los cuales ocho son accesos rápidos. El cofre de casa tiene 18 espacios independientes.
- En mochila se seleccionan dos espacios para intercambiarlos; en cofre se pulsa una pila para transferirla al otro inventario.
- Las transferencias y cosechas fallidas por capacidad no pierden objetos ni cultivos.
- Guía de siete hitos: arar, sembrar, regar, dormir, cosechar, vender y comprar terreno.
- La hoz permite cosechar con clic o mediante el candidato próximo de E.

## Economía

- `src/game/data/balance.ts`: precios, duración y rendimiento agrícola, costes energéticos, capacidad de regadera, terrenos, encargos y mejoras.
- Tablón del mercado y diario: tres encargos de entrega única. La recompensa requiere consumir los productos.
- Mejoras permanentes: azada y hoz más eficientes; regadera de 48 cargas y menor consumo energético.

## Identidad y eventos

- Arte original generado localmente en `PixelArt.ts`: Tatiana, Ella, iconos, cofre y suelo con surcos secos/húmedos. El jugador usa un spritesheet propio.
- Jugador y Tatiana tienen animaciones de reposo, movimiento y acción; se añadieron vistas traseras/laterales.
- Partículas breves para agricultura, galaxia del observatorio y oleaje del mirador; sonido con mute.
- Cocina conserva ingredientes si no cabe el resultado y guarda el producto preparado.
- TV/DVD ofrece consejos agrícolas, información del observatorio y una viñeta narrativa original; no reproduce archivos de vídeo.
- La recompensa lunar se guarda por día; los eventos de Tatiana recuerdan cosecha, terreno y cena.

## Spritesheet del jugador

- `public/assets/characters/player/farmer-spritesheet.png` es una hoja original de 576×120 con 54 frames de 32×40: tres filas (abajo, arriba, lateral) y, en cada una, reposo (4), caminata (6), trabajo (4) y celebración (4).
- El lateral mira a la derecha; al caminar hacia la izquierda se voltea el sprite. Los frames de acción también existen para arriba y lateral, así que el personaje no cambia de pose al girar.
- `scripts/build-player-sheet.mjs` genera la hoja y su contorno de un píxel desde una paleta fija. Se regenera con `npm run assets:player`; no requiere dependencias nuevas.
- La caja de colisión es de 10×5 con desplazamiento (11, 33), ajustada a los pies del frame de 40 px. El Y-Sort sigue usando `depth = y`.
- `Player.ts` elige el sufijo (`_up`, `_side` o vacío) según `facing` y usa `player_work` para herramientas/cocina, `player_cheer` para enfados/emotes y `player_fear` para el susto.

## Narrativa, diálogos y pausas

- `DialogSystem` muestra nombre, retrato (con inicial de respaldo), texto con efecto de máquina de escribir y opciones. El texto avanza con `performance.now()`, así que mantiene su ritmo aunque bajen los FPS; E completa el mensaje y luego avanza.
- Las opciones aparecen solas al terminar el último mensaje y se dibujan como filas de 780×32 centradas sobre la caja de diálogo. Se eligen con ↑/↓, E o clic, y cada elección se ejecuta una sola vez.
- `SpeechBubble` unifica los bocadillos de jugador, Tatiana, mascotas e interacciones: siguen al hablante, respetan la cámara y se destruyen con su escena.
- `NarrativePause` detiene reloj, física, tweens y animaciones del mundo durante diálogos, paneles y cinemáticas, sin pausar `UIScene`. Al reanudar restaura solo lo que pausó y conserva el Y-Sort (`depth = y`).
- El HUD se oculta mientras hay diálogo o modal; las cinemáticas muestran su propio aviso de cierre (E).
- Tatiana patrulla casa, tiendas y playa. La elección «Ven conmigo» activa el seguimiento y se guarda en `registry`, por lo que se conserva al cambiar de escena; «Nos vemos luego» vuelve a patrulla.
- Eventos cinematográficos: observatorio (galaxia, cráteres, Plutón, recompensa lunar diaria) y mirador (atardecer o luz de luna, oleaje y fundido). Ambos respetan `prefers-reduced-motion`.
- Cocina y TV comparten el mismo lenguaje visual de paneles. La TV tiene carcasa, scanlines y tres canales (Huerto, Cielo, DVD) con textos originales; no reproduce vídeo real.

## Guardado y validación

- Se conserva el formato v1 y se aceptan guardados anteriores con ocho espacios y sin cofre/progreso ampliado.
- Se validan cantidades, identificadores, fechas, cultivos y progreso antes de cargar o escribir. Los errores de almacenamiento se muestran en la UI.
- `npm run build-nolog`: TypeScript y compilación de producción.
- `npm run test:e2e`: Playwright para UI, inventario, ciclo agrícola, edificios, encargos, mejoras, persistencia, observatorio, TV, diálogos con elecciones, seguimiento de Tatiana, pausas narrativas, spritesheet del jugador y tamaños de ventana.
- Las pruebas de integración preparan posiciones/recursos mediante el handle de desarrollo y ejecutan las acciones con teclado y ratón; no sustituyen una revisión completa de todos los caminos del mapa.

## Límites de esta entrega

- El canvas conserva 960×540 con escalado FIT. Se comprueba contención en ventanas de 375, 768, 1024 y 1440 px. En teléfono vertical el juego queda pequeño; todavía no hay controles táctiles de movimiento ni una UI específica de retrato.
- El jugador ya usa un spritesheet dedicado; Tatiana, Ella y las mascotas conservan el arte procedural como primera versión, susceptible de refinamiento artístico.
