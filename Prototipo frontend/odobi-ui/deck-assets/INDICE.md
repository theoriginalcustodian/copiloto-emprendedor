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

Para cada `mockups/*/index.html`: se numeran los `.canvas-wrap`, se inyecta un `<style>` que deja visible sólo el lane N, se fija `body` a 2560×1440 y se escala el wrap con `transform:scale(min((2560−120)/960, (1440−120)/(altoCanvas+110)))`. La `@font-face` se reescribe a ruta absoluta `file://` porque la página generada vive fuera de la carpeta del mockup. Después:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=2560,1440 \
  --virtual-time-budget=2500 \
  --screenshot=deck-assets/<nombre>.png "file://<pagina>"
```
