# Deck assets — 27 slides, 2560×1440 PNG

Generadas 02/08/2026 desde los `index.html` de `mockups/` con Chrome headless. **Una slide por lane**, con su etiqueta arriba y su pie de continuidad abajo. Regenerables: el script vive en el historial de la sesión; la receta está al final.

## Orden narrativo sugerido

El deck cuenta un sistema, no una galería de pantallas. El orden va de **qué es** → **cómo entrás** → **qué ves todos los días** → **cómo se ejecuta** → **qué lo sostiene**.

### 1 · El sistema (4 slides)
| Archivo | Qué muestra |
|---|---|
| `00-mapa-lane1.png` | Esquema UX: el ciclo completo |
| `00-mapa-lane2.png` | Decisión A — nav de 3 tabs + Cuenta en el avatar |
| `00-mapa-lane3.png` | Decisión B — terracota = sólo lo tocable |
| `00-mapa-lane4.png` | Decisión C — el puente Mi día → Chat |

### 2 · El primer minuto (3 slides)
| Archivo | Qué muestra |
|---|---|
| `01-onboarding-lane1.png` | El aterrizaje del splash = el reveal · "se dice o-DO-bi" |
| `01-onboarding-lane2.png` | La promesa · 6 servicios = 2 permisos |
| `01-onboarding-lane3.png` | La promesa cumplida, con plata real |

### 3 · La portada del negocio (2 slides) — *el corazón del argumento*
| Archivo | Qué muestra |
|---|---|
| `09-mi-dia-lane1.png` | Mi día con avisos: números reales + detector determinista |
| `09-mi-dia-lane2.png` | Mi día sin avisos: **Odobi se calla** (el silencio hace creíbles a los avisos) |

### 4 · El chat: continuidad y ejecución (3 slides)
| Archivo | Qué muestra |
|---|---|
| `03-home-conversacional-lane1.png` | El puente: chip de contexto + HITL ya armado |
| `03-home-conversacional-lane2.png` | Preguntar (Inteligencia) + cierre de la promo |
| `03-home-conversacional-lane3.png` | La escucha (el momento display de la app) |

### 5 · El patrón madre: "Vos confirmás, Odobi ejecuta" (3 slides)
| Archivo | Qué muestra |
|---|---|
| `04-confirmacion-hitl-lane1.png` | Anatomía del HITL: encabezado + filas + alcance + decisión |
| `04-confirmacion-hitl-lane2.png` | Editar una fila antes de confirmar |
| `04-confirmacion-hitl-lane3.png` | El comprobante queda en el hilo |

### 6 · El mismo componente, tres features (6 slides)
| Archivo | Qué muestra |
|---|---|
| `05-facturacion-lane1.png` | Facturar por voz — lo que falta se pregunta |
| `05-facturacion-lane2.png` | Segundo HITL: la emisión (irreversibilidad frontal) |
| `05-facturacion-lane3.png` | Emitida: el CAE en el thread |
| `06-presupuestos-lane1.png` | Presupuesto por voz — los ítems se piden |
| `06-presupuestos-lane2.png` | Una sola puerta: HITL proporcional al riesgo |
| `06-presupuestos-lane3.png` | El ciclo: anotado → aprobado → factura |

### 7 · Lo que lo sostiene (6 slides)
| Archivo | Qué muestra |
|---|---|
| `02-conexiones-lane1.png` | Just-in-time consent: el permiso llega con el pedido |
| `02-conexiones-lane2.png` | Salvaguarda: conexión caída + la portada admite estar incompleta |
| `02-conexiones-lane3.png` | Cuenta › Conexiones: alcance y corte |
| `08-plan-limites-lane1.png` | Cuenta — el destino del avatar |
| `08-plan-limites-lane2.png` | El plan: **qué cuenta como acción** |
| `08-plan-limites-lane3.png` | El límite: se avisa hablando, con dos salidas |

## Advertencias para armar el deck

- **`08-*` es el único material de visión.** El backend no expone plan ni consumo. Si va al deck, la slide necesita decirlo — el PNG no lo trae adentro del frame a propósito (ver `mockups/08-plan-limites/DECISIONES.md`).
- **`00-mapa-*`** es esquema de trabajo, no UI. Sirve para abrir, no para mostrar producto.
- El **splash** (`explorations/splash-o/`) **no está acá**: es una animación de 6,84 s y una PNG lo traiciona. Va como video/Rive, o como la slide `01-onboarding-lane1.png`, que es su último frame.
- Las cifras son **orientativas de mockup** pero **internamente consistentes** entre pantallas (286 − 194 = 92 · 96 + 41 + 12 + 9 + 6 = 164 · la factura de Gómez es el mismo dato en 09, 03 y 02). Si se cambian, hay que rehacer la cadena entera.

## Cómo regenerar

⚠️ **Hay CUATRO scripts y el orden importa.** Correrlos sueltos deja piezas mezcladas
—texto nuevo con imagen vieja— y eso no se ve hasta que alguien abre el archivo.

```bash
cd odobi-ui
python3 deck-assets/regenerar.py           # 1 · las 33 láminas 2560×1440 del deck
python3 deck-assets/frames.py              # 2 · los 29 frames de teléfono (árbol)
python3 deck-assets/preparar-artifact.py   # 3 · reduce esos frames + extrae las notas
python3 deck-assets/construir-artifact.py  # 4 · arbol/arbol-web.html, todo embebido
```

**El 3 no es opcional.** `construir-artifact.py` no lee `frames/`: lee `_artifact/f1/`,
que son los mismos frames reducidos. Saltearlo el 24/08 dejó el árbol web con el copy
nuevo y **la captura vieja** — la pieza más difícil de auditar del proyecto, porque es
un archivo de 4 MB con todo en data-URI.

⚠️ **El copy de las tarjetas del árbol web está HARDCODEADO** en `construir-artifact.py`
(la tabla de bloques, ~línea 90), **no** sale de `arbol/index.html`. Editar el árbol y
regenerar pisa el cambio. Los dos se tocan a mano.

### Dos trampas del render (24/08/2026)

1. **Se sirve por HTTP, no por `file://`.** Desde el 19/08 los mockups no recrean la UI:
   cargan el prototipo por `<iframe>`. Bajo `file://` ese iframe **no resuelve el query
   string** y Chrome termina sirviendo el **listado del directorio** del mockup. Los dos
   scripts levantan un `http.server` efímero y renderizan contra él.
2. **Un verificador que se degrada en silencio no es un verificador.** `tiene_contenido()`
   usaba PIL con un `except ImportError` que caía **siempre** (PIL está roto acá: x86_64
   vs arm64), así que verificaba **por peso**. El listado de directorio pesaba 87 KB y
   pasó el gate en 6 láminas. Ahora mide en gris con **ffmpeg**: exige media > 120 (el
   lienzo es crema; un error renderiza casi negro) y desvío > 8 (una lámina plana da ~0).
   El log imprime los dos números — si dice `-1`, no midió nada.

### El detalle del render

Para cada `mockups/*/index.html`: se numeran los `.canvas-wrap`, se inyecta un `<style>`
que deja visible sólo el lane N, se fija `body` a 2560×1440 y se escala el wrap con
`transform:scale(min((2560−120)/960, (1440−120)/(altoCanvas+110)))`.

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=2560,1440 \
  --virtual-time-budget=4500 \
  --screenshot=deck-assets/<nombre>.png "http://127.0.0.1:<puerto>/mockups/<c>/<tmp>.html"
```
