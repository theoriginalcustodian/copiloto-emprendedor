# Benchmark — Facturitas (facturación AFIP/ARCA por WhatsApp con "Luna")

> **Fuente:** 20 capturas de pantalla de WhatsApp aportadas por el operador (`Factura/*.jpeg`), tomadas el
> 2026-07-10 entre las 10:53 y las 11:08. Sesión real de un usuario ("Martin") registrándose y emitiendo
> su primera factura. Se ignoró el `.zip` adjunto por ser duplicado de las mismas imágenes.
> **Propósito:** insumo directo para el diseño de la facturación conversacional AFIP/ARCA del Copiloto del
> Emprendedor (ver `CLAUDE.md §5` → `docs/copiloto-emprendedor/2026-07-06-HANDOFF-facturacion-afip-copiloto.md`).
> **Método:** todo lo que sigue está anclado a una captura concreta. Lo que las capturas NO muestran se
> declara explícitamente en §9 — no se completó nada por analogía ni por conocimiento general de AFIP.

## Legenda de capturas (orden cronológico reconstruido)

El reloj del dispositivo (esquina superior izquierda) es la fuente de orden primaria; dentro de un mismo
minuto se usó la continuidad del texto de la conversación.

| ID | Archivo | Hora en pantalla | Contenido |
|---|---|---|---|
| C01 | `WhatsApp Image 2026-07-10 at 11.09.31.jpeg` | 10:53 | Chat: mensaje de bienvenida inicial, 0% progreso |
| C02 | `WhatsApp Image 2026-07-10 at 11.09.32.jpeg` | 10:54 | Flow "Creá tu cuenta" — paso 1/3 (email) |
| C03 | `WhatsApp Image 2026-07-10 at 11.09.32 (1).jpeg` | 10:54 | Flow — paso 2/3 ("Decinos quién sos", CUIT/DNI) |
| C04 | `WhatsApp Image 2026-07-10 at 11.09.32 (2).jpeg` | 10:54 | Flow — paso 3/3 ("Último paso, Martin", Clave Fiscal) |
| C05 | `WhatsApp Image 2026-07-10 at 11.09.32 (3).jpeg` | 10:56 | Flow — paso 3/3 validado, botón "Activá tu cuenta" |
| C06 | `WhatsApp Image 2026-07-10 at 11.09.32 (4).jpeg` | 10:53 / 10:56 (msgs) | Chat: aparece "Luna", CUIT validado, inicia registro |
| C07 | `WhatsApp Image 2026-07-10 at 11.09.32 (5).jpeg` | 11:00 (msgs 10:57/10:58) | Chat: registro automático + usuario pregunta, espera |
| C08 | `WhatsApp Image 2026-07-10 at 11.09.32 (6).jpeg` | 11:02 | Chat: cuenta activa (50%), tap "Crear Factura" |
| C09 | `WhatsApp Image 2026-07-10 at 11.09.32 (7).jpeg` | 11:02 | Flow "Detalle de Venta" — fecha/condición/tipo de venta |
| C10 | `WhatsApp Image 2026-07-10 at 11.09.32 (8).jpeg` | 11:03 | Flow "Detalle del Item 1" — descripción/cantidad/precio |
| C11 | `WhatsApp Image 2026-07-10 at 11.09.32 (9).jpeg` | 11:03 | Flow "Detalle de operación" — ítem confirmado, total |
| C12 | `WhatsApp Image 2026-07-10 at 11.09.32 (10).jpeg` | 11:04 | Flow "Datos del Cliente" — IVA/CUIT opcional/envío |
| C13 | `WhatsApp Image 2026-07-10 at 11.09.32 (11).jpeg` | 11:04 | Flow "Resumen" (parte superior) |
| C14 | `WhatsApp Image 2026-07-10 at 11.09.32 (12).jpeg` | 11:04 | Flow "Resumen" (scrolleado, parte inferior) |
| C15 | `WhatsApp Image 2026-07-10 at 11.09.32 (13).jpeg` | 11:05 | Chat: PDF entregado + link al portal |
| C16 | `WhatsApp Image 2026-07-10 at 11.09.32 (14).jpeg` | 11:06 | Chat: nota de voz + HITL "Confirmar datos" |
| C17 | `WhatsApp Image 2026-07-10 at 11.09.32 (15).jpeg` | 11:07 | Chat: "Crear Factura Rápida" — pide producto en texto libre |
| C18 | `WhatsApp Image 2026-07-10 at 11.09.32 (16).jpeg` | 11:07 | Chat: "Mas opciones" → botón "Ver opciones" (circulado a mano) |
| C19 | `WhatsApp Image 2026-07-10 at 11.09.32 (17).jpeg` | 11:08 | Modal "Ver opciones" — catálogo de comandos |
| C20 | `WhatsApp Image 2026-07-10 at 11.09.32 (18).jpeg` | 11:08 | Modal "Ver opciones" con "Mi monotributo" tildado |

⚠️ **Contradicción de timestamps (marcada, no resuelta):** los mismos dos mensajes de Luna ("¡Soy Luna...";
"El CUIT es válido...") aparecen con hora **10:56** en C06 y hora **10:57** en C07. No hay forma de saber
desde las capturas si es un refresco de reloj del dispositivo, un reenvío, o un artefacto de la captura.

---

## 1. Qué es Facturitas

- **Producto:** bot de WhatsApp Business (cuenta verificada, tilde verde visible en todas las capturas)
  para emitir facturas AFIP/ARCA en Argentina. Marca: logo con ícono tipo medialuna/caracol sobre gradiente
  violeta-magenta, wordmark "Facturitas" (C01, C08, C17).
- **Canal único observado:** WhatsApp. El único otro canal mencionado es un **portal web** al que
  redirige después de emitir ("Mirá todas tus facturas en `https://www.web.facturitas.app`", C15) — no
  capturado, solo referenciado.
- **Persona conversacional:** "Luna, la contadora digital de Facturitas" — se presenta por nombre propio
  en el momento más sensible del flujo (justo después de pedir la Clave Fiscal), no antes (C06).
- **Segmento objetivo aparente:** monotributistas argentinos. Evidencia: tipo de factura default = **C**
  (C13, C14 — la factura C es la que emite un monotributista), condición de IVA default = "Consumidor
  Final" (C12), y el menú de opciones incluye "Mi monotributo — Revisá tu categoría y facturación" (C19).
- **Posicionamiento aparente:** velocidad y cero fricción ("facturar por WhatsApp" repetido en dos
  pantallas de bienvenida, C01 y C08) + trial gratuito ("14 DÍAS GRATIS 🎁", C08). No se capturó ninguna
  pantalla de precios/planes — ver §9.
- **Onboarding gamificado:** barra de progreso textual `[████░░░░░░] %` con checklist de 2 ítems
  ("Conectá tu cuenta con ARCA" / "Creá tu primer factura") visible en el primer mensaje y actualizada de
  0% (C01) a 50% (C08) tras completar el registro.

## 2. Flujo reconstruido paso a paso

Numeración continua sobre toda la sesión capturada. Los mensajes clave se transcriben **literalmente**
entre comillas.

1. **(C01, 10:53)** Usuario escribe: *"Hola! Quiero registrarme en Facturitas"*.
2. **(C01, 10:53)** Bot responde con tarjeta de bienvenida (banner + texto):
   > *"¡Bienvenid@! 😁 Registrate ahora mismo para empezar a facturar por WhatsApp! Progreso: [░░░░░░░░░░] 0% 👉 Conectá tu cuenta con ARCA 👉 Creá tu primer factura"*
   Botón único: **"Empezar Registro"**.
3. **(C02, 10:54)** Al tocar el botón se abre un **WhatsApp Flow** (formulario nativo embebido, no burbujas
   de chat) de 3 pasos con indicador de progreso `●○○` arriba. Paso 1: *"¡Hola! Creá tu cuenta 🚀"* — campo
   único **Email**, texto legal *"Al continuar, aceptás nuestros términos y condiciones"*, links a
   Términos y a Ayuda. Botón "Siguiente" (deshabilitado hasta completar).
4. **(C03, 10:54)** Paso 2/3 `●●○`: *"Decinos quién sos 👋 Ingresá el CUIT o DNI con el que vas a
   facturar."* — campo **CUIT o DNI** ("Sin puntos ni guiones") + nota: *"🏢 Si vas a facturar como
   sociedad (SRL, SA, SAS), primero ingresá el CUIT de la sociedad."*
5. **(C04, 10:54)** Paso 3/3 `●●●`: *"Último paso, Martin 😎"* — el CUIT ya ingresado (`20330693445`)
   aparece repetido pero **deshabilitado/atenuado** (de solo lectura), y el bot ya sabe el nombre "Martin"
   (resuelto desde el CUIT). Campo nuevo: **Clave Fiscal**, con disclaimer de seguridad:
   > *"🔒 Tu clave fiscal no se visualiza ni se almacena. Se usa una única vez por nuestra IA para vincular ARCA con Facturitas y luego se descarta."*
6. **(C05, 10:56)** Misma pantalla 3/3, tras validar: el ícono cambia a una credencial con check violeta,
   texto *"¡Listo, tus datos son validos!"* y aparece el botón verde **"Activá tu cuenta"**.
7. **(C06, mensajes 10:56)** De vuelta en el chat: se ve el bloque "Empezar Registro / Respuesta enviada"
   confirmando el envío del Flow. Aparece **Luna** por primera vez:
   > *"¡Soy Luna, la contadora digital de Facturitas 😊! Esperame un segundo mientras reviso la información del CUIT"*
   > *"El CUIT es válido. Voy a empezar el registro automático 😎. Dame un minuto!"*
8. **(C07, 10:58–11:00)** Continúa: *"El registro automático inició correctamente; en breve vas a poder
   usar Facturitas 🚀. ¡Esto puede demorar unos minutos!"* (10:58). El usuario, sin instrucción previa,
   pregunta: *"Que tengo que hacer ahora?"* (11:00). Bot responde: *"Estamos procesando su registro
   automático, aguarde un momento 🙏…"* (11:00).
9. **(C08, 11:01–11:02)** Llega la activación: *"¡Hola, tu cuenta ya está activa! Ya podés facturar en
   ARCA por WhatsApp 🎉. Progreso: [█████░░░░░] 50% ✅ Registro exitoso 👉 Creá tu primer factura y activá
   tus 14 DÍAS GRATIS! 🎁"* con tres botones: **Crear Factura**, **Crear Factura Rapida**, **Mas
   Opciones**. Usuario toca **"Crear Factura"** (11:02). Bot: *"¡Ya casi estamos! Toca el boton a
   continuación para completar los datos de tu factura y generar el comprobante en ARCA 🙌"*, botón
   **"Completar datos"**.
10. **(C09–C14, 11:02–11:04)** Se abre un segundo WhatsApp Flow multi-pantalla para cargar la factura —
    detalle en §4.
11. **(C15, 11:04–11:05)** Vuelta al chat: "Completar datos / Respuesta enviada" (11:04). Bot: *"Procesando,
    en breve te enviaremos el comprobante!"* (11:04). Se entrega el **PDF adjunto**
    (`20330693445_011_00003_00000001.pdf`, 137 KB) seguido de: *"¡Factura creada correctamente. Te
    compartimos el comprobante! Mirá todas tus facturas en https://www.web.facturitas.app"* y *"Enviá tu
    factura por email o cancelala"* con link **"Ver acciones →"** (11:05).
12. **(C16, 11:05–11:06)** Reaparece el menú de bienvenida abreviado (*"Bienvenido a Facturitas! Selecciona
    el comando que quieras utilizar"*, 11:05). El usuario envía una **nota de voz** (0:08 seg, 11:06). Bot:
    *"Procesando audio..."* (11:06) y a los pocos segundos presenta una tarjeta de confirmación HITL:
    > *"Confirmar datos — Se crearán los siguientes comprobantes: • Una factura para el servicio: **servicios web** por el importe de **AR$300000**. ¿Confirmás los datos para facturar?"*
    Tres botones: **Confirmar**, **Cancelar**, **Editar y Confirmar** (11:06).
13. **(C17, 11:07)** En otro punto del chat (tras "Ver acciones →"), el usuario toca **"Crear Factura
    Rápida"** sobre el menú de bienvenida. Bot: *"Ingrese el producto o servicio a facturar — Recordá que
    Factura Rápida solo aplica a consumidores finales y el precio total debe ser menor a $10.000.000"*,
    botón **Cancelar**.
14. **(C18, 11:07)** El usuario en cambio toca **"Mas opciones"**. Bot: *"Selecciona una opción para
    continuar:"* con botón **"Ver opciones 📋"** — este botón aparece **rodeado con un círculo amarillo
    dibujado a mano**, que no es parte de la UI de WhatsApp (posible anotación externa de quien armó el
    dossier — ver §9).
15. **(C19, 11:08)** Se abre el modal **"Ver opciones"** con 7 ítems, cada uno con título + subtítulo:
    *Mis Comprobantes* ("Descargá o compartí tus facturas emitidas"), *Mi monotributo* ("Revisá tu
    categoría y facturación"), *Facturación Masiva* ("Facturá muchas ventas subiendo un Excel"),
    *Facturación Automática* ("Conectá Mercado Pago o Tienda Nube y facturá automaticamente"), *Facturá
    con Audio o Foto* ("Generá una factura enviando un audio o foto"), *Agregar nuevo CUIT* ("Sumá otro
    CUIT a tu cuenta"), *Ayuda* ("Contactanos y revisá las preguntas frecuentes").
16. **(C20, 11:08)** El usuario selecciona **"Mi monotributo"** (check verde) y aparece un botón **"Enviar"**
    al pie del modal. No hay captura de qué pasa después de tocar "Enviar" — ver §9.

## 3. Onboarding ARCA

Reconstrucción de la conexión de la cuenta fiscal (pasos 2–9 de §2):

1. **Trigger:** frase libre del usuario ("Hola! Quiero registrarme en Facturitas", C01) — no un comando
   estructurado, lo cual sugiere NLU/intent-matching en el primer mensaje, o simplemente el saludo por
   defecto de WhatsApp Business dispara el template de bienvenida.
2. **Formulario, no chat:** los 3 datos de identidad fiscal (email, CUIT/DNI, Clave Fiscal) se piden a
   través de un **WhatsApp Flow nativo** (formulario embebido con su propio header, barra de progreso de
   pasos y footer "Administrado por Facturitas") — nunca como texto libre en el chat. Orden exacto: **(1)
   Email → (2) CUIT o DNI → (3) Clave Fiscal**, uno por pantalla, sin poder saltear (C02, C03, C04).
3. **Resolución de identidad progresiva:** al llegar al paso 3, el CUIT ya ingresado se muestra
   **deshabilitado** y el bot ya saluda por el nombre de pila ("Último paso, Martin 😎") — evidencia de
   un lookup síncrono contra un padrón (probablemente el padrón público de AFIP/ARCA) apenas se completa
   el paso 2, ANTES de pedir la Clave Fiscal (C04).
4. **Disclaimer de seguridad in-situ:** justo debajo del campo Clave Fiscal, no en un link aparte:
   *"🔒 Tu clave fiscal no se visualiza ni se almacena. Se usa una única vez por nuestra IA para vincular
   ARCA con Facturitas y luego se descarta."* (C04) — mitigación explícita de la objeción más obvia de
   pedir la contraseña fiscal por chat.
5. **Validación sincrónica visible:** tras enviar la Clave Fiscal, la MISMA pantalla del Flow se
   actualiza in-place a un estado de éxito ("¡Listo, tus datos son validos!" + ícono de credencial con
   check) antes de que el usuario vuelva al chat (C05). Es decir, hay al menos una validación rápida
   (formato/existencia) que ocurre dentro del Flow, previa al registro automático completo.
6. **Espera larga, manejada en el chat (no en el Flow):** al tocar "Activá tu cuenta" el usuario vuelve al
   chat, donde Luna narra el proceso en 3 mensajes secuenciales espaciados en el tiempo — "reviso la
   información del CUIT" → "el CUIT es válido, empiezo el registro automático" → "el registro automático
   inició correctamente... puede demorar unos minutos" (C06, C07). **No hay indicador de progreso
   numérico ni ETA** durante esta espera — el único feedback adicional lo dispara el propio usuario al
   preguntar "Que tengo que hacer ahora?" (C07).
7. **Duración observada de principio a fin:** desde "Empezar Registro" (10:53/10:56 según la
   discrepancia señalada) hasta "tu cuenta ya está activa" (11:01) — **~5 a 8 minutos** de reloj,
   incluyendo el tiempo que el usuario tardó en completar los 3 campos del Flow.
8. **Cierre del onboarding = mismo mensaje de bienvenida, ahora con progreso al 50%** y botones de acción
   ya habilitados (C08) — reutiliza la plantilla de C01, dándole continuidad visual al usuario.

## 4. Slot-filling de la factura

Ruta **"Crear Factura"** (la ruta guiada; hay otras dos rutas — ver más abajo). Igual que el onboarding,
se resuelve con un **WhatsApp Flow multi-pantalla**, no con preguntas sueltas en el chat.

Orden exacto de pantallas y campos observado (C09→C14):

1. **"Detalle de Venta"** (C09) — agrupa varios campos en una sola pantalla:
   - **Fecha de la factura** — prellenada con la fecha de hoy ("10 Jul. 2026"), editable (ícono X para
     limpiar).
   - **Condición de Venta** — campo con chevron, **vacío/sin seleccionar** en la captura disponible.
   - **Tipo de Venta** — selector de 3 opciones en radio: Producto / **Servicio** (preseleccionado, con
     check verde) / Productos y Servicios.
   - **Fecha Desde / Fecha Hasta** — marcados "Opcional", visibles solo si el tipo de venta es o incluye
     Servicio (texto: "En caso de facturar un servicio, puede seleccionar las fechas del mismo").
2. **"Detalle del Item 1"** (C10) — pantalla separada, un ítem a la vez:
   - **Descripción del item** — textarea libre (contador de caracteres visible, ej. "499").
   - **Cantidad** — numérico, default **1**.
   - **Precio Unitario** — numérico, vacío.
   - Botón **"Confirmar Item"**.
3. **"Detalle de operación"** (C11) — vuelve a una pantalla resumen de ítems:
   - Lista de ítems confirmados con formato `cantidad x precio — descripción — SubT: $monto` (ej. *"1,00 x
     $250.000,00 — Servicios web — SubT: $250.000,00"*).
   - Link **"+ Agregar otro Item"** (soporta múltiples ítems por factura).
   - Total acumulado al pie + botón **"Continuar"**.
4. **"Datos del Cliente"** (C12):
   - **Condición del IVA** — prellenada con **"Consumidor Final"** (default, editable con X).
   - **CUIT o DNI** — marcado explícitamente **"Opcional"**, con nota: *"El CUIT del cliente NO ES
     OBLIGATORIO para esta venta según el PRECIO y el MEDIO DE PAGO"* (regla de negocio AFIP expuesta
     como copy, no oculta).
   - **"Enviar factura a cliente (Opcional)"** — chips seleccionables **WhatsApp** / **Email** ("Selecciona
     hasta 2 opciones"), ninguno tildado en la captura.
   - Pie de pantalla: **"Tipo de Factura: C"** (no editable en esta vista, mostrado como dato informativo).
   - Botón **"Siguiente"**.
5. **"Resumen"** (C13, C14) — última pantalla antes de emitir, ver §5.

**Memoria/valores por defecto observados:** fecha = hoy, tipo de venta = Servicio, cantidad = 1, condición
de IVA del cliente = Consumidor Final, tipo de factura = C. No hay evidencia en las capturas de que estos
defaults vengan de un histórico del usuario (primera factura de la cuenta) — se interpretan como defaults
estáticos del producto, no como "memoria" de datos previos. **Inferido, no confirmado:** las fechas
"Desde"/"Hasta" del resumen final coinciden con la fecha de factura sin que se vea al usuario tocar esos
campos — pudo ser un default silencioso o una edición no capturada (ver §9).

**Dos rutas alternativas al slot-filling guiado**, activadas desde el mismo menú de bienvenida (C08,
C16, C17):
- **"Crear Factura Rápida":** un solo campo de texto libre — *"Ingrese el producto o servicio a
  facturar"* — con restricción explícita: *"solo aplica a consumidores finales y el precio total debe ser
  menor a $10.000.000"* (C17). No se capturó el resto de este flujo (ver §9).
- **"Facturá con Audio o Foto":** el usuario manda una nota de voz de 8 segundos sin ningún prompt previo
  visible en el chat; el bot responde "Procesando audio..." y directamente entrega una tarjeta de
  confirmación con los datos ya extraídos — *"Una factura para el servicio: servicios web por el importe
  de AR$300000"* (C16). Es decir, esta ruta **saltea todo el slot-filling paso a paso** y va directo a la
  confirmación HITL (§5) con los datos inferidos del audio.

## 5. Confirmación pre-emisión (HITL)

Hay **dos implementaciones distintas** de confirmación antes de emitir, una por ruta:

- **Ruta "Crear Factura" (guiada, Flow):** la última pantalla del Flow es **"Resumen"** (C13, C14) — una
  tabla de solo lectura, sin checkboxes de edición campo por campo, que muestra:
  - Total a facturar destacado arriba ("💰 AR$ 250.000,00").
  - Tabla **"📋 Datos de emisión"**: Fecha, Cond. de venta, Tipo de venta, Tipo factura, Desde, Hasta, Vto.
    pago.
  - Tabla **"👤 Cliente"**: Razón Social (mostró "n/a"), Cond. IVA.
  - Tabla **"🛒 Datos de operación"**: Descripción, Cant. x Precio, Subtotal, por cada ítem.
  - Total repetido al pie + **único botón "Crear Factura"** (no hay botón "Editar" ni "Volver" visible en
    esta pantalla del Flow — para corregir algo, hay que retroceder con la flecha "<" del header, fuera
    del área de contenido).
- **Ruta "Facturá con Audio o Foto" (chat):** la confirmación es una **tarjeta de chat**, no un Flow, con
  copy explícito de pregunta — *"¿Confirmás los datos para facturar?"* (C16) — y **tres botones**:
  **Confirmar**, **Cancelar**, **Editar y Confirmar**. Esta ruta sí ofrece edición explícita antes de
  confirmar, a diferencia del Resumen del Flow guiado.
- No se capturó la confirmación pre-emisión de la ruta "Crear Factura Rápida" — ver §9.

## 6. Entrega del comprobante

Observado únicamente para la ruta guiada (C15):

1. Tras tocar "Crear Factura" en el Resumen, el bot vuelve al chat y muestra de inmediato: *"Procesando,
   en breve te enviaremos el comprobante!"*.
2. Segundos después llega el **PDF como adjunto nativo de WhatsApp** (documento, no imagen), nombrado
   `20330693445_011_00003_00000001.pdf` (CUIT + punto de venta + tipo de comprobante + número — patrón de
   nomenclatura reconocible de AFIP), 137 KB.
3. Mensaje de cierre: *"¡Factura creada correctamente. Te compartimos el comprobante! Mirá todas tus
   facturas en https://www.web.facturitas.app"* — con link a un **portal web** para el histórico completo
   (no se capturó ese portal).
4. Mensaje adicional de acciones: *"Enviá tu factura por email o cancelala"* con link **"Ver acciones →"**.
   No se capturó qué UI abre ese link — ver §9. El verbo **"cancelala"** es notable: en términos fiscales
   argentinos una factura ARCA emitida no se "cancela", se anula mediante una Nota de Crédito; el copy
   podría estar simplificando de más un concepto legal — marcado como observación, no como hallazgo (no
   sabemos qué acción real dispara ese botón).
5. **No hay preview del PDF dentro del chat** antes de que se genere (no se vio un paso de "así va a
   quedar tu factura, ¿la generamos?" con la imagen real del comprobante — la única confirmación visual
   previa es la tabla de datos del Resumen, §5).

## 7. Manejo de errores y esperas

- **Espera de registro automático (§3, paso 6):** manejada 100% con mensajes de texto secuenciales de
  Luna, sin barra de progreso ni ETA. El único momento en que el sistema da una pista de duración es el
  texto *"Esto puede demorar unos minutos!"* (C07) — genérico, no un tiempo estimado concreto.
- **Espera reactiva ante inacción del usuario:** cuando el usuario pregunta "Que tengo que hacer ahora?"
  en medio de la espera, el bot NO reconoce que es una pregunta fuera de flujo — responde con el mismo
  mensaje de estado que ya venía mostrando ("Estamos procesando su registro automático, aguarde un momento
  🙏…", C07), sin resolver la pregunta explícita del usuario sobre qué acción tomar.
- **Espera de emisión del comprobante:** un solo mensaje de "Procesando, en breve te enviaremos el
  comprobante!" (C15) antes de la entrega del PDF — más corta que la del registro, sin indicador de
  progreso tampoco.
- **Espera de transcripción de audio:** "Procesando audio..." (C16) — sin indicador de progreso.
- **Ningún error real capturado.** Las 20 imágenes documentan exclusivamente el camino feliz (CUIT válido,
  clave fiscal correcta, registro exitoso, factura emitida sin objeciones de ARCA). No hay evidencia de
  qué pasa ante CUIT inválido, clave fiscal incorrecta, ARCA caído/timeout, campo fuera de rango (p. ej.
  superar el tope de $10.000.000 de Factura Rápida), o rechazo del comprobante — ver §9.

## 8. Tabla: qué copiar / qué evitar

| Patrón observado | Por qué funciona (o no) | ¿Adoptar en el Copiloto? | Justificación |
|---|---|---|---|
| Barra de progreso textual + checklist de 2 ítems en el primer mensaje de onboarding (C01, C08) | Gamifica un proceso de por sí tedioso (dar de alta ante AFIP); el usuario ve "falta 1 paso" en vez de un formulario sin fin | **Adaptado** | Nuestro copiloto es chat puro (no Flows nativos de WhatsApp); replicar la idea de progreso visible como parte del copy conversacional, no como UI ajena |
| Disclaimer de seguridad pegado al campo de Clave Fiscal, no en un link aparte (C04) | Mitiga la objeción #1 de pedir una contraseña fiscal por chat, en el momento exacto en que más se necesita | **Sí** | Regla dura de nuestro proyecto también — nunca mutar/loguear credenciales (CLAUDE.md §Seguridad); el copy explícito de "se usa una vez y se descarta" es el mínimo aceptable de transparencia |
| Resolución de identidad progresiva: pedir CUIT primero, saludar por nombre después de resolverlo, recién ahí pedir la clave (C03→C04) | Reduce la sensación de "le estoy dando mis credenciales a un desconocido"; genera prueba social de que el bot ya te conoce antes del paso más sensible | **Sí** | Aplica igual de bien a un flujo conversacional puro: primero identificar (CUIT/DNI), confirmar identidad verbalmente, y solo ahí solicitar la credencial fiscal |
| Espera larga (registro ARCA) narrada solo con texto secuencial, sin ETA ni progreso numérico, y sin reconocer la pregunta del usuario "¿qué hago ahora?" (C06, C07) | Genera ansiedad; el usuario tiene que insistir para obtener una respuesta que tampoco resuelve su pregunta real | **No** (evitar tal cual) | Nuestro moat es la orquestación durable con Temporal — tenemos la infraestructura para dar progreso real (activity heartbeats, signals) en vez de placeholders genéricos; no replicar la ambigüedad |
| Resumen tabular completo (emisión + cliente + operación) como última pantalla antes de emitir, sin poder editar campo por campo desde ahí (C13, C14) | Da transparencia total del acto irreversible, pero fuerza al usuario a retroceder pantallas si algo está mal | **Adaptado** | Adoptar la transparencia total pre-emisión (crítico: una factura ARCA es fiscalmente irreversible sin nota de crédito); mejorar permitiendo editar un campo puntual desde el propio resumen, sin perder el resto de los datos ya cargados |
| Confirmación HITL con 3 botones — Confirmar / Cancelar / **Editar y Confirmar** — en la ruta de audio (C16) | Da una salida intermedia entre "todo bien" y "empezar de cero": corregir un dato sin perder el resto | **Sí** | Encaja directo con nuestra regla de HITL antes de acciones irreversibles (facturación AFIP califica); "Editar y Confirmar" es superior al patrón de solo Confirmar/Cancelar del Resumen del Flow guiado |
| Tres rutas de entrada con fricción decreciente: Flow guiado paso a paso / texto libre de un campo / audio con extracción automática (C08, C16, C17) | Cubre desde el usuario que quiere control total hasta el que quiere velocidad cero-fricción, sin forzar una sola UX | **Sí** | Es el patrón multi-modal natural para un agente conversacional (nuestro producto es justamente eso); evaluar cuál de las 3 rutas conviene como default según el tipo de emprendedor |
| Transcripción del audio nunca se muestra al usuario antes de la confirmación — solo se ve el resultado interpretado ("servicios web", "$300000") (C16) | Ahorra un paso, pero si el modelo de speech-to-text o el extractor entendió mal el monto/producto, el usuario no tiene cómo detectarlo antes de leer el resumen final | **No** (evitar tal cual) | Con LLM + audio, mostrar la transcripción cruda junto a los datos extraídos cuesta poco y baja el riesgo de emitir una factura con datos mal interpretados — más aún tratándose de un documento fiscal |
| Entrega del PDF como adjunto nativo del chat + link a portal web con el histórico (C15) | Doble canal: satisfacción inmediata (documento en mano) y persistencia (no se pierde si se borra el chat) | **Sí** | Directamente aplicable: adjuntar el PDF en el propio chat del copiloto y ofrecer un puntero a "tus facturas" (Drive/portal), en línea con el scope ya fijado en el handoff de facturación AFIP (`[Guardar]`/`[Compartir]`, Drive/mail como punteros) |
| Copy "Enviá tu factura por email o **cancelala**" para acciones post-emisión (C15) | Usa lenguaje coloquial que puede confundirse con la anulación fiscal real (nota de crédito), sin que se sepa qué acción dispara realmente | **No** | Evitar un verbo que sugiera reversibilidad de un acto fiscal que no lo es; si el copiloto ofrece "anular", debe dejar explícito que dispara una Nota de Crédito, no un borrado |
| Botón "Crear Factura" vs. "Crear Factura Rápida" en el mismo menú, sin explicar la diferencia real (formulario completo vs. campo único) hasta que el usuario prueba uno (C08, C09, C17) | Ambigüedad de naming: un usuario nuevo no puede predecir qué UX le espera detrás de cada botón | **No** (evitar tal cual) | Si el copiloto ofrece más de una vía para facturar, nombrarlas por lo que hacen distinto ("factura con todos los datos" vs. "factura en un mensaje"), no por un adjetivo de velocidad que no comunica el tradeoff real |

## 9. Preguntas abiertas

Lo que las 20 capturas **no muestran** y habría que averiguar antes de tomarlo como referencia de diseño:

1. **Selección de "Condición de Venta"** — en C09 el campo aparece vacío con chevron; en el Resumen final
   (C13) ya figura como "Transferencia Banc…". No hay captura de la pantalla donde se elige, ni de qué
   otras opciones ofrece.
2. **Fechas "Desde"/"Hasta" del servicio** — en C09 aparecen como "Opcional"; en el Resumen (C14) figuran
   completadas con la misma fecha que la factura. No se vio al usuario tocarlas — puede ser default
   silencioso o edición no capturada. Marcado como **inferido, no confirmado**.
3. **Chips "Enviar factura a cliente" (WhatsApp/Email)** — se ven sin marcar en C12; no se sabe si el
   usuario los usó, ni qué pasa si se seleccionan (¿el bot le manda la factura a un tercero?).
4. **Qué abre "Editar y Confirmar"** en la tarjeta HITL de la ruta de audio (C16) — no hay captura del
   estado siguiente.
5. **Qué pasa tras tocar "Enviar"** en el modal "Ver opciones" con "Mi monotributo" tildado (C20) — es la
   última captura de la secuencia; no se ve la respuesta a esa consulta.
6. **Resto del flujo de "Crear Factura Rápida"** (C17) — solo se capturó el primer prompt ("Ingrese el
   producto o servicio a facturar"); no se sabe si después pide precio, cliente, confirmación, ni cómo
   luce esa confirmación.
7. **Ningún camino de error** — CUIT inválido, Clave Fiscal incorrecta, ARCA caído o con timeout, monto
   fuera de tope de Factura Rápida (>$10.000.000), rechazo de ARCA al emitir. Cero evidencia; todo lo
   documentado es camino feliz.
8. **"Facturación Masiva" (Excel) y "Facturación Automática" (Mercado Pago/Tienda Nube)** — solo aparecen
   como ítems de menú con una línea descriptiva (C19); no hay ninguna captura de esos flujos.
9. **Precio/planes después del trial** — se menciona "14 DÍAS GRATIS 🎁" (C08) pero no hay captura de
   pricing, límites del plan gratuito, ni qué pasa al vencer.
10. **Discrepancia de horario 10:56 vs. 10:57** en los mismos dos mensajes de Luna entre C06 y C07 — no
    resuelta, ver nota en la legenda.
11. **Círculo amarillo dibujado a mano alrededor de "Ver opciones"** en C18 — no es parte de la UI de
    WhatsApp; no se sabe si es una anotación de quien armó el dossier señalando algo para discutir, o
    tiene otro origen. No se le asignó significado en este documento.
12. **Preview real del PDF antes de emitir** — la única confirmación visual pre-emisión es la tabla de
    datos del Resumen (§5); no se vio ningún mockup o preview gráfico del comprobante en sí antes de
    generarlo.
13. **Qué pasa si se toca la flecha "<" para volver atrás dentro del Flow** (para corregir un dato ya
    cargado) — no se capturó ese camino de edición dentro del formulario guiado.
