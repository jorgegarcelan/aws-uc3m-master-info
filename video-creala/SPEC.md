# SPEC · Créala, el making-of

```text
GOAL:    Quien lo ve entiende que la charla del seminario se montó como un videojuego,
         pieza a pieza, y le dan ganas de ver el deck entero.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    35,0 s x 30 = 1050 frames. Música a ~84 BPM; rejilla de medios tiempos
         G(n) = 0,052 + 0,35765·n s (10,7 frames). Corte en el medio tiempo, cambio de plano en el compás (8 medios tiempos).
LOOK:    Dos suelos, los dos del propio deck:
         - cielo: linear 180° #3f92f2 → #5aa2f4 34% → #8fbef6 68% → #dcebfd 92% → #f6faff, nubes pixel blancas;
         - taller: papel cuadriculado #eef4fd con líneas #d5e4f9 cada 40 px (la rejilla del editor de píxeles).
         Tinta #0b0d10, azul #1f7ff5 / #1667d6, oro #fbbf24, mundos #6366f1 / #f59e0b / #10b981.
         Display: Silkscreen 700 en mayúsculas, 120–280 px. Texto: Inter Tight 700, 56–92 px.
         Medio: pixel art. Sombras duras sin desenfoque (6–12 px, tinta), bordes de 4–6 px, sin brillos.
OBJECTS: la diapositiva en blanco (marcadores de puntos de PowerPoint), el avatar de 30 x 42 px,
         las tres puertas sobre nubes, las capas de una slide, la rejilla de 23 slides, el cursor pixel.
MOTION:  llegada expo.out 0,4–0,6 s; cámara power2.inOut; salida y zoom a través de puerta power3.in 0,34 s;
         sprites y letras pixel con steps(); muelles solo en posición y escala (back.out 1.6).
SHOTS:
  0,00–2,91  En blanco. «Charla para el seminario AWS × UC3M» ya escrito; se teclea «¿y si fuera un videojuego?». Teclas.
             → el cielo baja por filas y tapa la diapositiva.
  2,91–8,63  La idea. MIS NUBES (3,63) + UN VIDEOJUEGO (4,34); en 5,77 caen las tres puertas, «de puertas y mundos»;
             el avatar llega en su nube. → la cámara entra en el avatar.
  8,63–13,25 El personaje. Se pinta fila a fila sobre la rejilla (30 × 42 píxeles), salta y saluda (10,78),
             salen las 7 poses y el resto de sprites; echa a andar. → barrido lateral.
  13,25–17,22 Una slide por capas. Cielo, nubes, puertas, avatar y texto separados en 3D; en 15,79 se cierran
             y la cámara empuja hasta la slide real a pantalla completa.
  17,22–20,08 El deck. La slide se encoge a su hueco y entran las otras 22; contador hasta 23.
             El cursor pulsa la primera. → esa miniatura crece hasta llenar el plano.
  20,08–31,53 La versión final. Capturas reales a 3840 px: portada, mapa, y tres mundos entrando por cada puerta
             (morada 21,5 · ámbar 24,7 · verde 27,6), una slide por tiempo. → iris que se cierra sobre el avatar.
  31,53–35,00 Cierre. Se abre el iris: «No esperes a tener experiencia: CRÉALA», «Mi charla del seminario AWS × UC3M, hecha videojuego», @jgarcelan. 2,5 s quieto.
BANNED:  fondo oscuro con cosas flotando; brillos, bloom y partículas; etiquetas pequeñas encima de los títulos;
         pasos numerados; rótulos que explican lo que ya se ve; todo entrando con fade + subida;
         títulos que se mueven después de aterrizar; capturas reescaladas por encima de 1:1.
QA:      0,5 · 2,2 · 4,6 · 6,8 · 9,6 · 11,6 · 14,9 · 16,7 · 18,8 · 21,2 · 23,0 · 26,7 · 30,5 · 33,5
         y las costuras 2,9 · 8,63 · 13,5 · 16,3 · 20,08 · 31,5.
```
