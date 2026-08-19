# DECISIONES — Prototipo navegable

Creado el 18/08/2026. **Es «el prototipado», que era el pendiente declarado del árbol** (`arbol/DECISIONES.md` §4: *"el árbol muestra el prototipo, no el prototipado"*). Ahí las flechas dicen a dónde lleva cada acción; acá **se llega**.

## 1 · Por qué funcional y no un clickable de imágenes

| Opción | Qué prueba | Veredicto |
|---|---|---|
| Imágenes con hotspots (los 29 frames ya existen) | A dónde lleva cada tap | **Descartada.** No prueba **gestos**, y el gesto ES la decisión que hay que validar. Un prototipo que no se arrastra no dice nada sobre un modelo de capas |
| **HTML funcional con drag real** | El gesto, el snap, la relación entre capas, y el efecto de una acción sobre la pantalla de atrás | **Elegida** |
| Figma | — | Habría que rehacer las 11 pantallas allá. El CSS ya está escrito en los mockups |

## 2 · Las decisiones

| Elemento | Decisión | Fundamento |
|---|---|---|
| Alcance | **Sólo lo que valida el modelo**: Mi día · chat · escritorio · una función (Gastos) · escucha · card · el puente | Un prototipo que intenta ser la app entera no se termina nunca y no prueba nada mejor. Las otras pantallas ya viven en los mockups |
| Gestos | **Pointer Events con arrastre 1:1 y snap al soltar** | Es lo mismo que hace `PanelDeslizable` en el repo. Con `transform` (no `top`) para no disparar layout en cada frame — la misma razón por la que el repo abandonó animar `height` |
| Tap además de arrastre | Un toque en el composer o en el asidero hace lo mismo que el gesto | **WCAG 2.5.1**: toda función por gesto de trayectoria necesita alternativa de un punto. Y es el comportamiento que el repo ya tiene (`\|Δ\|<5px` → toggle) |
| Umbrales de snap | Chat: cruza al 65 % · escritorio: al 35 % | Asimétricos a propósito: **abrir el chat tiene que ser más fácil que cerrarlo** (es la acción frecuente), y revelar el escritorio más difícil que volver (es la excursión) |
| El efecto de guardar | Al guardar el gasto, **la lista y el total de atrás cambian** | Es la mitad del argumento de la voz contextual: *ves el efecto donde ya estabas mirando*. Sin eso, la card podría estar en cualquier lado |
| El puente | Confirmar deja receipt en el chat **y la tarjeta de Mi día en estado resultado** | Es lo único del sistema que no se entiende explicándolo. Acá se recorre y se ve cerrar el ciclo |
| Marco | En el celular ocupa la pantalla entera (`100dvh` + `env(safe-area-inset-*)`); en escritorio, marco de 390×844 | En el teléfono el prototipo tiene que sentirse app, no página. El marco en desktop es para mostrarlo, no para usarlo |
| Sin anotaciones | Ninguna | **Esto se usa, no se lee.** El fundamento está en los mockups y en el árbol |

## 3 · Cómo se sirve

`servir.sh` levanta `python3 -m http.server` **desde `odobi-ui/`, no desde esta carpeta**: el HTML referencia `../assets/fonts/`, y sirviéndolo desde acá el wordmark saldría sin la fuente. El script imprime la IP de la WiFi para abrirlo en el celular.

## 4 · Lo que NO es

- **No hay backend.** Los datos son fijos; al recargar vuelve al inicio.
- **No reemplaza a los mockups ni al árbol**: no lleva anotaciones ni fundamentos.
- **No es la app**: es el mínimo necesario para poder responder «¿el gesto funciona?» con el pulgar en vez de con una opinión.
