# Receta de la pasada de device — fichas de frontend2 que esperan UNA captura

**Dueño de la receta:** frontend2. **Dueño del aparato en la ventana:** quien tenga el teléfono (hoy frontend1);
nadie más corre `adb`. Dos clientes ADB fabrican evidencia falsa.
**Complementa** (no reemplaza) la receta previa de J1 · K5 · N30 · N32 · N34 · N35 que está en el buzón
(`receta_frontend2-a-frontend1-y-planificacion_capturas-de-device-de-J1-K5-N30-N32-N34-N35-UNA-pasada.md`):
esas seis siguen valiendo tal cual. Acá van las que **no** estaban.

## Reglas comunes (valen para todas)

1. **Cuenta:** `e2e-device@copiloto.test`, la única canónica. **Excepción declarada:** SM-K2 y SM-J3 piden un
   tenant SIN datos o SIN vínculo (`e2e-vacio`); ahí **no** se muta la canónica (desvincularla o vaciarla
   rompe lo que esperan las otras fichas).
2. **Binario/bundle:** Metro local sirviendo `origin/main` con dev-client ya instalado (`--clear` al arrancar).
   Anotar el SHA servido en cada captura: una medición contra un bundle viejo ya dio un veredicto falso (N32).
3. **Gestos:** cualquier Pan/swipe/hold es `adb shell input motionevent DOWN/MOVE/UP`. **Nunca `input tap`**
   sobre un gesto de RNGH: no lo ejercita y da un verde falso. Los taps simples de botón sí son `input tap`.
4. **Nombre de archivo:** `<ficha>-<que>-390[-<piel>].png` en `capturas/`; en el nombre o en un `.txt` hermano:
   SHA servido, cuenta, `wm size`, `wm density`, `font_scale`.
5. **Si una entrada exige una condición especial, va escrita con lo que podría falsear.** Está en cada fila.

## Las fichas

| Ficha | Estado previo (y con qué cuenta) | Gesto exacto | Archivo | Qué se mira → cierra el DoD | Qué podría falsear |
|---|---|---|---|---|---|
| **SM-Z4** (wordmark del login) | Sin sesión → login. Canónica no hace falta: es pantalla pública. Leer antes `adb shell settings get system font_scale` y `adb shell wm density`. | Abrir el login; `uiautomator dump` + captura. | `z4-login-wordmark-390.png` + `.txt` con `font_scale`, density | Nodo `login-wordmark`: tamaño real = 32 dp × density/160 × `font_scale` (en px). Debe coincidir con el prototipo (`index.html:517`, 32). **Anotar `font_scale`**: la app tiene 0 `allowFontScaling`, o sea mide 32 × fontScale; con escala ≠ 1 la foto no prueba el 32. | Un `font_scale` ≠ 1,0 del aparato cambia el tamaño sin que el código cambie. Si no es 1,0, fijarlo a 1,0 **y anotarlo** (es una escritura de ajuste del sistema; restaurar al terminar). |
| **SM-Z3** (par logotipo/color) | Igual que Z4 (misma pantalla). | Igual que Z4. | `z3-login-logotipo-390.png` | Wordmark con `COLOR_PALABRA_MARCA` (`PantallaLogin.tsx:150-166`), mismo sentido que el reveal (`RevealEntrada.tsx:146`); tamaño real en device. Una sola foto sirve a Z3 y Z4 si lleva los datos de Z4. | Capturar con el tema nocturno del sistema: el contraste cambia. Anotar modo de pantalla. |
| **SM-Z5** (Ajustes: lista vs grilla) | Canónica, Ajustes (`/ajustes`). | Abrir; `uiautomator dump`. | `z5-ajustes-lista-390.png` | Filas de lista con **subtítulo y chevron**, no grilla de 3 columnas; los nodos `ajuste-tile-<key>` de las **8** entradas presentes y «Mi plan» ausente (la sacó SM-N42). | Comparar contra el mapa servido en `127.0.0.1:8931` (checkout compartido, difiere de `main`): usar el `index.html` de `origin/main`. |
| **SM-J1** | Ya está en la receta previa (los 6 docks). | — | — | — | — |
| **SM-J3** (2 estados que faltan) | (a) Canónica **con datos** y mes en curso; (b) refresh en curso. El tercer estado (global «Sin ventas todavía») ya lo capturó frontend1 en `e2e-vacio`. | (a) abrir Inteligencia y capturar la cabecera en card blanca con período + etiqueta de mes + mosaicos. (b) **Pull-to-refresh con `motionevent`**: DOWN arriba, MOVE hacia abajo ~600 px, y **capturar con el dedo aún apoyado** (antes de UP). | `j3-cabecera-datos-390.png`, `j3-refresh-en-curso-390.png` | (a) Cabecera, etiqueta de mes y mosaicos dibujados. (b) **NO se toca el `RefreshControl`** (`PantallaInteligencia.tsx:203-211`): el criterio es que el arco **no salga negro opaco encima del saldo**; el indicador debe quedar fuera de cuadro o legible, nunca tapando el saldo. | Capturar tras UP: el arco ya se fue y la foto no prueba nada. Una animación del sistema apagada deshace el arco; **no apagar animaciones** (ya hizo que un tap no abriera). |
| **SM-J4** (DoD 3) | Un tenant cuyo cliente tenga `facturasAtribuibles:false`: el tenant `48a9d75f` lo da en prod según backend. **Cuenta distinta de la canónica**; solo lectura. | Abrir Clientes y la tarjeta de ese cliente. | `j4-cliente-sin-atribuibles-390.png` | La tarjeta (`TarjetaCliente`) con el caso `facturasAtribuibles:false` (sin doc): debe verse como lo describe el DoD 3 (el «guion largo»), no un monto inventado. | No hay forma de fabricar el caso en la canónica sin escribir datos: si el tenant no se puede usar, **no se simula**; queda `Falta:` con el motivo. |
| **SM-K2** (mitad «sin vincular») | **Tenant `e2e-vacio`** (sin vínculo ARCA). **Nunca desvincular la canónica.** | Ajustes → ARCA; tocar `afip-ambiente-prod-vincular` si aplica. | `k2-sin-vincular-390.png` | Estado SIN VINCULAR del bloque de ARCA, distinto del vinculado. La mitad (b) ya está medida. | Si `e2e-vacio` tampoco está sin vínculo, la foto muestra otro estado; anotar el `GET` de estado de la cuenta. |
| **SM-N29** (DoD 1) | Canónica con sesión. | `logout` voluntario y **grabar con `screenrecord` a ≥30 fps** (sin `--bit-rate` bajo) durante todo el reveal. | `n29-reveal-30fps.mp4` | El reveal **entero** con su animación de entrada; medir la duración (~6,8 s) cuadro a cuadro. | A 1 fps el primer fotograma ya muestra el estado final y parece un veredicto: verificar los fps reales del archivo (`ffprobe`) antes de citarlo. |
| **SM-N34** | Ya está en la receta previa. | — | — | — | — |
| **SM-N41** (veredicto binario) | Canónica. Chat con **mensajes suficientes** para que haya texto de la burbuja **exactamente detrás** del campo del composer; scroll al fondo. Hacerlo en **las dos pieles** (cambiar en `/ajustes-skins`). | Abrir el chat; dejar el campo vacío y sin foco; una captura por piel. | `n41-campo-<clara\|oscura>-390.png` | Una sola pregunta, binaria: **¿se LEE el texto de la burbuja de atrás a través del campo? sí / no**, por piel. No «¿se ve legible?». `ALFA_BASE_CAMPO = 0.96` (`Composer.tsx:302`). | Si no hay texto detrás del campo, la foto no puede decir «no se lee»: es ausencia de estímulo, no veredicto. Verificar que el texto de fondo **existe** (control positivo). |
| **SM-N19** (DoD 4) | Canónica, micrófono con permiso. | **Dictar un gasto por voz** → esperar la card → **corregir un campo de la card** → confirmar. El dictado es voz real o un audio reproducido al micrófono. | `n19-dictar-card-corregir-confirmar-<1..4>.png` (una por paso) | El camino completo **dictar → card → CORREGIR → confirmar**. La corrida previa (`evidencia/SM-N19.md`) fue una card por **texto** que terminó en «Descartar»: acredita otro camino. Tras confirmar, verificar en servidor que quedó guardado el valor **corregido**, no el original. | Pedir la card por texto cambia el camino (ya pasó). Si la card no ofrece corregir, **eso** es el hallazgo: no se simula. No verifiqué el testID del control de corregir; anotarlo al verlo. |
| **SM-N32** (resto) | Canónica con categoría de monotributo cargada (SM-N35). | Abrir Inteligencia y scrollear una vez. | `n32-acumulado-tope-390.png` | La barra «N% del tope» (`AcumuladoAnual.tsx:80-91`, testID `...-tope`) con categoría cargada. Sin categoría **no** debe haber barra (fail-soft: eso también es evidencia). | Cuenta sin escala vigente ⇒ `tope:null` y no hay barra aunque haya categoría; anotar cuál caso fue. |

## Orden sugerido (menos navegación y menos cambios de estado)

1. Sin sesión: **Z4/Z3** (login) → luego login canónica.
2. Canónica: **Z5** (Ajustes) → **N32** → **J3 (a y b)** → **N41 clara** → `/ajustes-skins` → **N41 oscura** → **N19** (mutación: al final).
3. Grabación: **N29** requiere logout: va **después** de lo que necesita la sesión, y antes de la pasada de otra cuenta.
4. Otras cuentas (cambio de sesión): **K2** (`e2e-vacio`), **J4** (tenant con `facturasAtribuibles:false`).
5. Restaurar `font_scale` y cualquier ajuste del sistema que se haya tocado.

## Al terminar

Un `cierre_` por ficha con `FICHA: / SHA: / DOD:` (SHA = el de `origin/main` servido). El estado lo escribe
`sprint-estado.py`; quien captura aporta la evidencia, no el marcado.
