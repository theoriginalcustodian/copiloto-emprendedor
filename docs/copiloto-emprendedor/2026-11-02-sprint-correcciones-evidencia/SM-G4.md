# SM-G4 · R03: el retardo al soltar es demora, no defecto

**Veredicto: demora.** Los dos rótulos llegan rancios a +0,3 s y a +0,8 s, y correctos a +3 s, en las 4 corridas. El estado no se pierde.

**Device:** Android físico, usuario canónico, dev-client con Metro. Fecha: 2026-11-02.
**Gesto:** escritorio abierto → chat arriba → bajar el chat.

## Las tres capturas

Frames del video de la corrida 1. La suelta está en t = 2,503 s.

| Corte | Rótulo de arriba | Rótulo de abajo | Pantalla | Captura |
|---|---|---|---|---|
| +0,3 s | «Subí para volver a Mi día» (rancio) | «Bajá para volver a Mi día» (rancio) | Escritorio abierto, chat abajo | `SM-G4-1-mas-0-3s.webp` |
| +0,8 s | «Subí para volver a Mi día» (rancio) | «Bajá para volver a Mi día» (rancio) | Escritorio abierto, chat abajo | `SM-G4-2-mas-0-8s.webp` |
| +3 s | «Bajá para tus funciones» | «Escribile a Odobi» | Mi día | `SM-G4-3-mas-3s.webp` |

## Lo medido en las 4 corridas

Tiempos desde la suelta.

| Corrida | Chat llega | Escritorio empieza a cerrar | Escritorio cerrado | Rótulo de abajo | Rótulo de arriba |
|---|---|---|---|---|---|
| 1 | +0,11 s | +1,32 s | +1,55 s | +2,36 s | +2,70 s |
| 2 | +0,11 s | +1,30 s | +1,54 s | +2,34 s | +2,68 s |
| 3 | +0,11 s | +1,48 s | +1,68 s | +2,60 s | +2,94 s |
| 4 | +0,09 s | +1,28 s | +1,48 s | +2,30 s | +2,62 s |

## Qué descarta y qué no

- **Descarta M1 y M3** (estado perdido o rancio para siempre): 4 de 4 corridas se corrigen solas.
- **Confirma M2** (el estado llega después de la animación), pero **no su cifra**. La lectura del 2026-10-16 estimaba 0,4-0,7 s y lo medido es 2,3-2,9 s.
- **Lo que más se nota no es el rótulo:** durante 1,3-1,5 s, con el chat ya abajo, el escritorio sigue abierto. La señal de cerrarlo se dispara al inicio del resorte (`avisarBajada`, `PanelDeslizable.tsx:348`), así que el retardo no se explica solo por esperar a que termine el resorte. **Hipótesis sin medir:** el hilo de JS tarda en hacer el commit. La mide SM-I6.

## Límites de esta medición

- **Corrió en dev-client, no en release.** La decisión del operador del 2026-10-16 deja el build de release para el final, así que no se compiló. Las cifras pueden bajar en release; el veredicto no depende de ellas. El ejercicio en release sigue pendiente.
- **`screenrecord` y «mostrar toques» estaban activos** y pueden sumar carga. «Mostrar toques» se restauró a 0, verificado.
- **La suelta no se leyó del punto del toque**, que no se distingue en el video. Es el primer tramo de movimiento que no depende de un salto de MOVE. El control manual sobre la corrida 1 da el mismo frame (2,503 s).
- **El gesto es sintético** (`input motionevent`), con pasos más lentos que un dedo real.

## Qué sigue

SM-I6 corrige igual, como pide el plan. Primero mide dónde se van los 1,3 s, porque el arreglo depende de eso. El candidato sigue siendo fijar los rótulos al inicio del movimiento en lugar de al final.
