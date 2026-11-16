# REVIEW · Créala, el making-of

Render: `renders/creala-making-of.mp4` · 1920×1080 · 30 fps · 35,0 s · calidad `delivery`.

## Decisiones
- Storyline del propio Jorge: el encargo (charla del seminario) → la idea (mis nubes + un videojuego de puertas y mundos) → el proceso (personaje, capas de una slide, las 23 slides) → la versión final. No se escribieron storylines alternativas.
- Proyecto HyperFrames nuevo, sin la plantilla de brag. Los sprites son los SVG exportados de `tres-puertas/theme/theme.js`; las slides son capturas reales del deck a 3840×2160 (`slaas shot --scale 2`), nunca ampliadas por encima de 1:1 salvo en los zooms a través de puerta.
- Cada costura tiene causa: el cielo baja sobre la diapositiva en blanco, la cámara entra en el avatar, barrido al salir andando, la miniatura pulsada llena el plano, zoom por cada puerta, iris de videojuego al final.

## Medido
- `hyperframes check`: 0 errores. Avisos que se quedan: `duplicate_media_discovery_risk` (el mismo sprite usado varias veces a propósito: nubes, poses).
- Audio del MP4: −16,0 LUFS integrados, pico real −1,0 dBTP, sin clipping. Medido, no escuchado.
- Fotogramas del MP4 revisados en 16,7 · 22,6 · 25,9 · 30,5 s: texto de las slides nítido también en el punch-in de 1,45×.

## Sin comprobar
- Cómo suena la mezcla (niveles de efectos frente a la música) y si los golpes caen en el tiempo fuerte: la rejilla sale de `hyperframes beats`, no de oído.

## Plano más flojo
- 6,5–8,2 s: las tres puertas ya han caído y solo llega el avatar. Con más tiempo, las puertas se abrirían una a una enseñando el color de cada mundo.

## unslop-ui (--surface)
- Quitada la fila de corazones, moneda y estrella bajo «+ UN VIDEOJUEGO» (U11).
- Se quedan: el degradado de cielo (es el fondo del deck), las líneas de la cuadrícula (linear-gradient usado para dibujar líneas), las sombras duras (token `shadow-px` del deck) y los muelles de puertas y sprites (el movimiento es la pieza).

## Créditos (CC BY, hay que incluirlos al publicar)
- Música: «Walking Shoes (Loop)» de Adam_Zero, freesound.org/s/678993
- Efecto: «Power Up» de StudioCopsey, freesound.org/people/StudioCopsey/sounds/77245
