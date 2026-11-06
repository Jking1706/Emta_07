# Comparativa y plan de mejoras

## Alcance

Comparativa basada en documentación pública de tres referencias, revisión del código actual y las capturas/pruebas Playwright realizadas durante el desarrollo. No se han jugado los tres proyectos externos en esta revisión. Las recomendaciones son decisiones para nuestro juego, no funcionalidades copiadas.

### Referencias consultadas

1. **[Stardew Valley — presentación oficial](https://www.stardewvalley.net/about/)**. Describe progresión de habilidades, desbloqueos, comunidad, horarios de NPC, recetas y personalización. Referencia para conectar sistemas y dar objetivos a corto y largo plazo.
2. **[Farmhand — repositorio y README](https://github.com/jeremyckahn/farmhand)**. Juego web de gestión agrícola. Documenta PWA/offline, convenciones de arte, migraciones del estado, utilidades de pruebas, Playwright y CI. Referencia especialmente útil por su plataforma web.
3. **[PyDew Valley — Clear Code](https://github.com/clear-code-projects/PyDew-Valley)**. Proyecto educativo en Python. Su índice organiza el desarrollo por movimiento, herramientas, overlay, cámara, colisiones, suelo conectado, riego, lluvia, plantas, cosecha, día y comercio. Se consultó el índice público de entregas, no el contenido de sus archivos RAR. Referencia de secuencia de implementación, no de arquitectura interna auditada ni de producto terminado.

## Qué ya funciona como base

- Ciclo de arar, sembrar, regar, crecer y cosechar, con siete frames originales.
- Energía, agua, tiendas, oro, compra de parcelas y persistencia.
- Diálogo con retrato, texto progresivo y bloqueo de movimiento.
- Descanso y procesamiento agrícola por día persistido.
- Identidad propia en el observatorio lunar, Tatiana, mascotas y recursos pixel art recientes.

## Comparativa resumida

| Área | Lección de la referencia | Situación actual | Aplicación recomendada |
| --- | --- | --- | --- |
| Progresión | Stardew conecta actividades con habilidades, recetas y zonas | Hay mecánicas y descuento de mercado, pero pocas metas encadenadas | Misiones breves que desbloqueen herramientas, recetas y terrenos |
| Personajes | Stardew describe horarios y contenido variable | Tatiana tiene patrulla/seguimiento y pocas frases | Agenda pequeña, diálogos por contexto y afinidad persistente |
| Web y guardado | Farmhand documenta migraciones y pruebas E2E | Un slot local, JSON sin validación estructural y pruebas temporales | Validación, migraciones, respaldo y suite reproducible |
| Arte | Farmhand documenta dimensiones, fuentes editables y consistencia | Recursos nuevos coherentes entre sí, mezclados con sprites provisionales | Guía de paleta, escala, pivotes y nombres; reemplazo gradual |
| Construcción del núcleo | PyDew separa suelo, riego, crecimiento, día y comercio en entregas | El núcleo existe, pero UI e interacciones se pisan | Cerrar una ruta completa y estable antes de ampliar contenido |

## P0 — Correcciones de funcionamiento

### 1. Terminar la centralización de interacción

- **Evidencia de código:** `CharacterInteractionSystem.update()` consume `JustDown(E)` incluso cuando no tiene un objetivo cercano. En `FarmScene.update()` corre antes de observatorio, mirador y rocola. Las prioridades añadidas para terrenos, edificios y Tatiana no cubren todo el flujo.
- **Cambio:** leer la pulsación una sola vez; recopilar candidatos por distancia/prioridad y ejecutar solo el ganador. Los sistemas deben ofrecer una acción, no consumir cada uno la misma tecla.
- **Aceptación:** desde una posición alcanzable, E activa cada punto interactivo; cerrar una ventana no activa otro objeto en ese frame. El prompt corresponde al objetivo seleccionado.
- **Esfuerzo relativo:** medio.

### 2. Hacer coherentes pausa, día y descanso

- **Evidencia de código:** `FarmScene.update()` actualiza reloj y cultivos antes de atender el diálogo. Si el cambio de día coincide con un diálogo, el retorno temprano omite el bloque de autoguardado. La cama programa un retorno diferido sin un estado explícito de descanso que impida repetir la acción.
- **Cambio:** estados de juego `playing/dialogue/menu/sleeping`; una única operación de cierre de día. Recomiendo pausar el tiempo en diálogos y menús. Impedir doble descanso durante la transición.
- **Aceptación:** mantener un diálogo abierto no hace perder el día; pulsar varias veces la cama solo avanza un día; guardar y recargar no duplica el crecimiento.
- **Esfuerzo:** medio.

### 3. Validar el guardado y la carga de producción

- **Evidencia:** `SaveSystem.load()` solo captura JSON inválido; un JSON válido con campos incorrectos pasa como `SaveGameData`. Los nuevos assets usan `BASE_URL`, pero muchos assets antiguos en `PreloadScene` siguen con `/assets/...`, mientras producción usa `/Emta_07/`.
- **Cambio:** validar versión/campos, completar valores compatibles, crear migraciones y conservar un respaldo. Unificar resolución de URLs. Manejar fallos de escritura sin mostrar un falso «guardado».
- **Aceptación:** una partida antigua o incompleta produce recuperación controlada; todos los assets cargan bajo `/Emta_07/`, sin 404. Mantener oro, parcelas y cultivos al recargar.
- **Esfuerzo:** medio.

## P1 — Mejoras de mayor impacto para el jugador

### 4. Separar la UI del zoom del mundo

- **Evidencia visual previa:** hotbar con nombres largos desbordados, paneles grandes sobre el mapa y texto de actividades recortado. HUD y diálogo tienen compensaciones de cámara distintas; otros overlays siguen usando coordenadas fijas con `scrollFactor(0)`.
- **Cambio:** `UIScene` o cámara UI dedicada, sin zoom; hotbar de iconos con cantidad y tooltip, barras compactas de energía/agua, diario plegable y notificaciones breves.
- **Aceptación:** ningún panel se recorta con zoom normal o mirador; los ocho slots son distinguibles; mapa visible durante exploración.
- **Esfuerzo:** medio-alto.

### 5. Separar mochila y hotbar

- **Evidencia:** el inventario tiene ocho slots y los ocho tipos de objetos iniciales los ocupan. La prueba de cosecha confirmó rechazo con inventario lleno. Plantar todas las semillas libera un slot, pero el jugador no recibe orientación suficiente sobre esa restricción.
- **Cambio:** mochila inicial de 16–24 slots, hotbar de accesos y un cofre. Como corrección mínima, reservar espacio inicial para cosechas y comunicar dónde guardar objetos.
- **Aceptación:** cosechar ambos cultivos sin tener que eliminar herramientas; mover pilas y almacenar objetos; persistencia y operaciones atómicas cuando falta espacio.
- **Esfuerzo:** medio-alto.

### 6. Guiar los primeros diez minutos

- **Propuesta inspirada en la progresión de Stardew:** «Prepara 3 tiles → siembra → riega → duerme → cosecha → vende → visita una parcela».
- **Cambio:** diario pequeño con objetivo actual, requisito y recompensa. Corregir mensajes obsoletos, por ejemplo el ayuntamiento todavía anuncia que la compra de tierras llegará en el futuro.
- **Aceptación:** completar la secuencia sin instrucciones externas, sin teletransporte ni acceso al estado de depuración.
- **Esfuerzo:** medio.

### 7. Unificar arte de personajes y herramientas

- **Evidencia:** jugador y Tatiana comparten `character_sheet`; «Ella» sigue representada con figuras geométricas. Cultivos, retrato y estructuras nuevas ya tienen fuentes editables.
- **Cambio:** sprites propios y reconocibles; cuatro direcciones y estados de herramienta. Guía gráfica común: escala por tile, iluminación, contorno, pivotes y sombras. Mantener `assets/crops/README.md` como punto de partida.
- **Aceptación:** identificar jugador y NPC sin etiquetas, animaciones sin cortes de frame, herramientas legibles y personajes ordenados correctamente delante/detrás de objetos.
- **Esfuerzo:** alto.

### 8. Dar continuidad visual al suelo y al mapa

- **Referencia:** el índice de PyDew incluye suelo conectado antes de riego y plantas.
- **Evidencia:** el suelo labrado todavía son rectángulos independientes; nuevas estructuras se crean con posiciones en `FarmScene`.
- **Cambio:** tiles de tierra conectados por vecinos, surcos y variación seca/húmeda. Registrar estructuras, punto de apoyo, zona de uso y colisión en Tiled o datos separados.
- **Aceptación:** parcelas grandes con bordes continuos; riego legible; aproximarse a cada estructura desde un camino real. Verificar colisiones aparte de su aspecto visual.
- **Esfuerzo:** medio.

### 9. Hacer repetibles las pruebas

- **Referencia:** Farmhand documenta Playwright en CI y utilidades comunes de fixtures.
- **Evidencia:** las pruebas realizadas hasta ahora usan scripts temporales; `package.json` no declara Playwright ni un comando de pruebas. Varias comprobaciones preparan el estado directamente, por lo que no demuestran un recorrido completo por el mapa.
- **Cambio:** suite versionada, dependencia de desarrollo, fixtures y trazas/capturas al fallar. Separar pruebas de sistemas de pruebas con teclado/ratón.
- **Aceptación:** tras una instalación limpia, un comando prueba cultivo, venta, compra de parcela, diálogo, descanso y recarga. Al menos una ruta completa desde el spawn usando controles reales.
- **Esfuerzo:** medio.

## P2 — Profundidad y comodidad

### 10. Ajustar economía y ritmo del día

- **Datos actuales:** nabo, semilla 8 y venta 14 tras 2 riegos; calabaza, semilla 18 y venta 34 tras 3. Sin descuento ni otros costes: margen de 6 frente a 16, equivalente a 3 frente a 5,33 de oro por día de crecimiento y tile. No incluye capital inicial, energía, desplazamientos ni capacidad de inventario.
- **Ritmo:** `TimeSystem` comprime 24 horas en 120 segundos reales. Probar un día más largo es una hipótesis de diseño, no una duración definitiva.
- **Cambio:** medir tiempo hasta primera cosecha y parcela; dar a cada cultivo un motivo para elegirlo; mejoras de herramientas que cambien capacidad/área/coste en lugar de vender duplicados.
- **Aceptación:** tabla de balance y sesión real de prueba; al menos dos estrategias útiles y compras con efecto perceptible.

### 11. Dar continuidad a Tatiana y las mascotas

- **Cambio:** afinidad persistente, un regalo por día, agenda corta y diálogo según hora/progreso. Usar el observatorio como primera misión personal; variar retrato según emoción.
- **Aceptación:** lo ocurrido un día modifica una conversación posterior y sobrevive a recargar. No reiniciar la relación al cambiar de escena.

### 12. Audio y feedback de herramientas

- **Cambio:** sonidos breves de tierra, riego, cosecha, pasos y compras; ambiente por zona, control de volumen y silencio. La rocola actual muestra una sugerencia de playlist: convertirla en un reproductor local de pistas apropiadas al proyecto.
- **Aceptación:** cada acción tiene confirmación discreta, sin repetición molesta; audio funciona tras interacción del usuario y respeta volumen persistente.

### 13. Clima que afecte decisiones

- **Cambio:** empezar solo con lluvia: riega cultivos, cambia sonido/ambiente y libera energía para otras actividades. Persistir el clima diario para que recargar no lo vuelva a sortear.
- **Aceptación:** lluvia y riego manual cuentan una sola vez por día; el jugador puede conocer el clima. Introducir estaciones después de probar el calendario y el balance.

### 14. Definir soporte móvil real

- **Referencia:** Farmhand declara orientación a móvil y escritorio.
- **Evidencia visual previa:** en viewport vertical el juego mantiene su canvas horizontal, muy reducido, con grandes márgenes. No hay controles táctiles de movimiento.
- **Cambio:** si móvil es objetivo de lanzamiento, diseñar primero landscape, joystick/botones táctiles y UI adaptable. Un canvas que cabe no equivale a jugabilidad táctil.
- **Aceptación:** sembrar, conversar, comprar y guardar con dedos en un dispositivo real; sin necesidad de teclado. Validar legibilidad y áreas táctiles.

## Orden recomendado

1. **Base fiable:** interacción única, pausa/descanso, guardados y URLs de producción.
2. **Primera partida comprensible:** UI, mochila, tutorial breve y pruebas repetibles.
3. **Identidad visual:** personajes, herramientas, suelo conectado y datos de estructuras.
4. **Profundidad:** balance, relaciones, audio y lluvia.
5. **Distribución:** soporte móvil y, si se necesita, offline/PWA.

### Hito de aceptación

Una persona nueva puede jugar 15–20 minutos, obtener su primera cosecha, venderla, entender el próximo objetivo, conversar con Tatiana y guardar/reanudar sin ayuda externa. La compra de una parcela debe ser alcanzable mediante el balance elegido, sin conceder oro desde herramientas de desarrollo.

**Primera implementación recomendada:** punto 1, seguido de UI y mochila. Son mejoras que hacen aprovechable el contenido y los sprites que ya existen.
