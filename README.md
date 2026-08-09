# Odobi

**Hablale como a un socio. Te contesta con tus números reales.**

*(Anteriormente conocido como Copiloto del Emprendedor)*

No es un chatbot con acceso a tu contabilidad. Es un copiloto que factura ante ARCA, anota lo que entra y lo que sale, arma presupuestos, y a la mañana te dice qué se te está pasando — sin que vos tengas que acordarte de abrir nada.

> 🇦🇷 Pensado para el emprendedor argentino: monotributista, estudio chico, oficio, servicio.
> El que factura, cobra, compra y no tiene un administrativo.

---

## El problema que resuelve

El emprendedor no odia la administración. **Odia el momento.** Facturar mientras manejás, anotar un gasto con las manos llenas, acordarte el lunes de un presupuesto que mandaste el jueves. La plata no se pierde en la planilla: se pierde en los diez segundos en que era fácil anotarla y no se pudo.

Por eso todo acá empieza hablando. Dictás como le contarías a alguien, y el copiloto arma el formulario por vos.

```
🗣️  "Cobré ochenta mil de González por el service"
🤖  [muestra la ficha completa, ya cargada, para que la revises]
```

**Nunca te va a pedir un "sí" a ciegas.** La respuesta a un dictado no es *¿confirmás?* — es el formulario real, precargado con lo que entendió. Porque si escuchó mal el monto, un "sí" no lo arregla: sólo lo arregla verlo y tocarlo. Y mientras esa ficha está en pantalla, **todavía no se guardó nada**.

---

## Qué sabe hacer

### 🧾 Facturar ante ARCA (ex-AFIP)
Emite facturas de verdad, con CAE, contra el organismo. Factura A, B y C, notas de crédito y formato PDF listo para enviar. Podés dictar *"facturale a Pérez cincuenta mil"* y revisar la factura antes de que salga — porque emitir es irreversible y eso siempre se confirma.

### 💰 Ingresos
Todo lo que entró, en un solo lugar: lo que dictaste, lo que cobraste de una factura, y lo que vio MercadoPago de forma automática. Cada uno sabe de dónde salió (origen `voz`, `manual`, `mercadopago`, etc.) — no es lo mismo lo que vio el sistema que lo que tipeó alguien apurado.

### 💸 Gastos
Lo que salió, con su categoría y su proveedor. Se dicta igual que un ingreso. Y se puede imputar a la cadena de un *trabajo* que lo generó, que es lo que después permite saber si ese trabajo dejó margen o no.

### 📄 Presupuestos
Armás el presupuesto hablando, sale un documento presentable para mandarle al cliente, y queda vivo: **ganado, perdido, o todavía no sé**. Ese "no sé" es a propósito — si los no marcados contaran como perdidos, tu tasa de conversión te mentiría feo. Y cuando el cliente acepta, **un botón lo convierte en factura** sin retipear nada.

### 👥 Clientes
No es una agenda que hay que cargar. Tu cartera **se arma sola** con lo que ya facturaste y presupuestaste. Cuántas veces le vendiste a cada uno, cuánto, y cuándo fue la última vez.

### 📊 Contabilidad
Caja y facturación mostradas como dos preguntas separadas, nunca sumadas: **qué entró y qué salió** (caja), y **qué facturaste**. Porque una factura emitida no es plata en el bolsillo hasta que te la pagan, y confundir esas dos cosas es la forma más común de quedarse sin caja.

### 🧠 Inteligencia de Negocio
Te **explica** el negocio, no sólo te lo muestra: en qué mes te fue mejor, quiénes son tus mejores clientes, qué rubro deja más margen. Podés preguntarle en castellano.
**Los números salen siempre de tu base de datos, nunca de un modelo calculando de memoria** — un número mal una sola vez y no volvés a mirar la pantalla.

### ☀️ Mi Día
El único lugar donde el copiloto **habla primero**. Cada mañana arma las tarjetas de lo que hay que atender: la factura que sigue impaga, el presupuesto que nadie contestó, el gasto sin categoría. La mayoría se cierra sola cuando el tema se resuelve. **No hay un modelo de lenguaje decidiendo qué es urgente**: son reglas fijas y verificables, porque un aviso que se inventa cosas se ignora a la semana.

### 🔑 Google Sign-In Nativo
Autenticación robusta y directa utilizando el Credential Manager nativo en dispositivos móviles e integración directa en la web.

### 🔌 Tus apps, conectadas
Gmail, Drive, Sheets, Docs, Calendar, HubSpot, Instagram y MercadoPago. El presupuesto se convierte en un Doc, la factura se archiva sola, el mail sale con tu tono. Y lo irreversible (mandar un mail, emitir, cobrar) **siempre te pregunta antes**.

### ⚙️ Apariencia e Identidad (Odobi Skin)
Cinco temas visuales completos diseñados con relieve y contraste de accesibilidad mejorado (AA). Funciona tanto en el teléfono móvil como en la web (PWA) de forma responsiva.

---

## Lo que lo hace distinto

**No se pierde nada.** Si se corta la luz, se cae internet o se cierra la app en la mitad de una factura, la operation **retoma sola donde iba**. La conversación está orquestada de forma durable con Temporal: sobrevive a caídas de servidores, cortes de red y reintenta de forma automática sin perder estado.

**No te dice que hizo algo que no hizo.** Evitamos las alucinaciones de acción: si el copiloto no ejecutó la acción en el sistema externo, el texto de respuesta lo declarará honestamente.

**Falta un dato → guarda igual y te avisa. Parece repetido → te pregunta antes.** La asimetría es deliberada: un dato que falta se completa rápido; **un ingreso duplicado infla la caja y es difícil de detectar**.

**Se gana la confianza, no te la pide.** Arranca en modo de confirmación mostrando todo antes de guardar. Cuando detecta que dictás completo y sin corregir, te ofrece el modo automático. Aun así, **lo irreversible se confirma siempre**.

**Tus datos son tuyos.** Aislamiento estricto de datos por tenant (multitenant real), verificado mediante tests adversariales continuos que intentan cruzar la frontera de datos.

---

## En camino

Lo que está especificado y decidido, todavía no terminado. Se lista para que se sepa hacia dónde va, no como promesa de fecha.

| | Qué |
|---|---|
| 🎙️ | **Dictado a velocidad warp** — mantener apretado el botón graba, soltar envía. Sin pantallas intermedias, sin esperas |
| 📸 | **Foto del ticket** — sacás la foto, el copiloto lee el gasto |
| 📅 | **Tu agenda en Mi Día** — que la mañana incluya lo que tenés en Google Calendar, no sólo lo financiero |
| 🔁 | **Automatizaciones recurrentes** — "todos los meses facturale el abono a estos cinco" |
| 🤖 | **Agente de Soporte Técnico Autónomo** — soporte conversacional L1/L2 integrado directamente con el pipeline de autosanación para resolver incidencias técnicas y de uso |

---

## Estado del Proyecto

**Desplegado en producción (BETA-READY).** 
Toda la lógica core de facturación, presupuestos, clientes, ingresos y gastos está activa y probada de punta a punta en el VPS. Los módulos de Inteligencia, Mi Día y Contabilidad están finalizados. 

Actualmente nos encontramos en fase de preparación de la **Beta sin cobro** (lanzamiento con usuarios reales para recopilación de feedback), implementando mecanismos de feedback in-app, rate-limiting, y finalizando la portabilidad del cliente web responsivo (sprint M-WEB).

---

## Para desarrolladores

La documentación técnica —arquitectura, deploy, cómo correr los tests, el motor conversacional— está en **[README-TECNICO.md](README-TECNICO.md)**. El vocabulario del dominio (qué es un *trabajo*, por qué *cobro* no es lo mismo que *ingreso*) vive en **[CONTEXT.md](CONTEXT.md)**.

---

<sub>Producto de Agencia HyC. Repositorio privado.</sub>
