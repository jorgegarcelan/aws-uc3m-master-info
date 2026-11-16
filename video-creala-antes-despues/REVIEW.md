# REVIEW · Créala, antes y después

Render: `renders/creala-antes-despues.mp4` · 1920×1080 · 30 fps · 35,2 s · calidad `delivery` · hyperframes 0.9.45.

## Qué es
La misma charla dos veces: primero como diapositivas de PowerPoint por defecto, después como el deck real.
- 0–1,8 s · Cartel: cielo, avatar, las tres puertas y «De diapositivas a videojuego»; la cámara entra en el avatar.
- 1,8–7,2 s · PLAYER 1: el avatar se construye por partes (contorno, pelo, piel, chaqueta, camiseta, vaqueros, zapatillas) con sus 22 colores reales entrando en la paleta; salta, salen las 7 poses y un selector elige una.
- 7,2–10,1 s · ANTES: portada y «Tres mundos» en viñetas.
- 10,1–15,8 s · la slide de viñetas se inclina, le caen encima cielo, nubes, puertas, avatar y texto, y la pila se cierra en la slide real; ANTES rueda a DESPUÉS.
- 15,8–27,2 s · cuatro pares a pantalla completa (portada, péndulo, game over, misiones): entra la versión fea y se repinta en la real. El avatar la cruza corriendo en tres de ellas; en el péndulo baja el cielo por filas.
- 27,2–31,5 s · nueve slides reales más, una por medio tiempo, e iris sobre el avatar.
- 31,5–35,2 s · cierre «No esperes a tener experiencia: CRÉALA».

## De dónde sale el texto de las slides feas
De las slides reales, sin añadir nada: `01-start`, `05-hub1`, `11-w2-path`, `12b-w2-gameover`, `16-quests`. La numeración «N / 23» es la posición real de cada una en el deck.

## Medido
- `hyperframes check`: 0 errores. Avisos que se quedan: `duplicate_media_discovery_risk` (sprites repetidos) y `overlapping_gsap_tweens` en la escena de pares (el linter no resuelve los tiempos calculados; los fotogramas muestran cada barrido en su sitio).
- Audio del MP4: −16,0 LUFS, pico real −1,0 dBTP, sin clipping. Medido, no escuchado.

## unslop-ui (--surface)
Nada que cortar. Se quedan a propósito el pie «Jorge Garcelán · Máster de Informática · 2026» de las slides feas (son el «antes»), las palabras ANTES / DESPUÉS (cambian cuando cambia la slide) y el degradado de cielo del deck.

## Créditos (CC BY)
- Música: «Walking Shoes (Loop)» de Adam_Zero, freesound.org/s/678993
- Efecto: «Power Up» de StudioCopsey, freesound.org/people/StudioCopsey/sounds/77245
