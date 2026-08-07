# Mi negocio y tus datos fiscales AFIP

## Qué es y para qué sirve

Acá vive todo lo que el Copiloto necesita saber sobre tu negocio: qué vendés, cómo querés que te hable, y —lo más importante— tus datos fiscales para poder facturar por vos ante AFIP. Son dos cosas distintas que a veces se confunden: **Mi negocio** es el perfil comercial (qué vendés, tu tono de charla), y **Facturación AFIP** es el trámite fiscal (CUIT, condición de IVA, vínculo con ARCA). Cargar bien ambos es lo que hace que el Copiloto pueda facturar en tu nombre sin pedirte los mismos datos una y otra vez.

Se llega desde **Ajustes → Mi negocio** y **Ajustes → Facturación AFIP**, son dos pantallas separadas.

## Mi negocio: tu perfil comercial

En Ajustes → Mi negocio cargás:

- **Qué vendés o qué servicio ofrecés** — una descripción libre, por ejemplo "Instalaciones eléctricas domiciliarias y pequeñas obras".
- **A quién le vendés** — a empresas, a consumidor final, o a ambos.
- **Nombre comercial** — el nombre con el que te conocen tus clientes, que puede ser distinto de tu razón social.
- **Horario de atención** — por ejemplo "Lunes a viernes de 8 a 17".

Estos datos no son obligatorios para facturar, pero ayudan a que el Copiloto entienda mejor tu negocio cuando hablás con él.

Importante: **acá no se cargan tu CUIT, razón social, domicilio ni condición frente al IVA** — esos datos fiscales van aparte, en Ajustes → Facturación AFIP.

### Cómo trabaja tu copiloto: confirmación o automático

En la misma pantalla de Mi negocio vas a ver un bloque que te muestra si tu copiloto está pidiéndote **confirmación** antes de ejecutar acciones (el modo por defecto) o si ya está en modo **automático**. Si está en automático, tenés un botón para volver a pedir confirmación en cualquier momento. El paso hacia el modo automático no se elige desde acá directamente — se te va a ofrecer en el momento apropiado dentro del chat, según cómo uses la app.

### Cómo te habla el copiloto

También en Mi negocio podés ajustar:

- **Tono** — Formal o Cercano.
- **Largo de las respuestas** — Breve o Detallado.
- **Cómo querés llamarlo** — le podés poner un nombre propio, por ejemplo "Copi".

Estos cambios se guardan aparte del resto del perfil, así que si sólo tocaste el tono no hace falta que reescribas la descripción de tu negocio.

## Facturación AFIP: tus datos fiscales

Esta es la pantalla clave para poder emitir facturas. Tiene varias partes.

### Paso 1 — Cargar tu perfil fiscal

Los datos que pide, todos obligatorios para poder facturar:

- **CUIT** (11 dígitos, sin guiones). Una vez guardado queda bloqueado; si necesitás cambiarlo hay una opción explícita para eso.
- **Razón social**
- **Domicilio comercial**
- **Condición frente al IVA** — Monotributo, Responsable Inscripto o Exento.
- **Ingresos brutos**
- **Fecha de inicio de actividades**
- **Punto de venta** — el número de punto de venta que vas a usar para facturar (por defecto es el 1).

Si falta alguno de estos datos, la app no te deja avanzar y te dice puntualmente qué falta — por ejemplo *"Falta completar razón social en Ajustes"* o *"El punto de venta debe ser ≥ 1"*. Si el CUIT tiene un formato inválido, el aviso es *"El CUIT no es válido (11 dígitos, sin guiones)"*.

### Paso 2 — Vincular tu cuenta con ARCA

Una vez que tenés el perfil fiscal cargado, el siguiente paso es vincular tu cuenta con ARCA (el portal de AFIP). Son tres pasos dentro de la misma pantalla:

1. Confirmás el CUIT con el que vas a vincular.
2. Un mensaje de confirmación: *"Vas a vincular el CUIT [tu CUIT] con ARCA."*
3. Cargás tu **usuario de ARCA** y tu **clave fiscal**.

La app es explícita sobre tu clave fiscal: **no la guarda**. Al lado del campo vas a ver la aclaración: *"Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta."* Es literal — la clave se usa un instante para hacer el trámite ante AFIP y después se elimina; el Copiloto no la conserva en ningún lado, ni siquiera para volver a mostrártela.

#### Mientras se procesa la vinculación

Vas a ver mensajes que se van actualizando: primero "Iniciando la vinculación con ARCA…", después "Dando de alta tu cuenta en el portal de ARCA. Esto puede tardar varios minutos." y por último "Verificando que el alta se haya completado…". Es normal que tarde — puede llevar varios minutos porque el trámite se hace contra AFIP en tiempo real. Si pasan más de 10 minutos sin resolverse, la app te avisa que está tardando más de lo normal y te da la opción de reintentar.

Si ya tenías tu cuenta vinculada y un reintento posterior falla, no te preocupes: tu vinculación anterior sigue funcionando — el aviso te lo aclara para que no pienses que perdiste el acceso.

### Paso 3 — Elegir el ambiente: Homologación o Producción

Esta es una distinción importante que conviene entender antes de facturar en serio:

- **Homologación** — facturas de prueba, sin efecto fiscal real. Es el ambiente ideal para probar cómo funciona el circuito sin comprometerte a nada.
- **Producción** — comprobantes fiscales reales, con validez legal ante AFIP.

Podés tener ambos ambientes vinculados a la vez para el mismo CUIT, y cambiar entre uno y otro con un toque, sin tener que volver a cargar tu clave fiscal cada vez. El Copiloto arranca siempre en Homologación por defecto — es una decisión pensada para que, si algo se confunde, el peor caso posible sea una factura de prueba y nunca una real de más.

Vas a ver un botón distinto según el estado de cada ambiente: **Vincular** si todavía no lo activaste, **Usar este** si ya está vinculado pero no es el que estás usando ahora, y **Activo** cuando es el que está en uso.

### Paso 4 — Guardar tus facturas en Drive (opcional)

También podés activar un interruptor para que el Copiloto guarde automáticamente una copia de cada factura que emitís en tu Google Drive. Para que funcione necesitás tener Google Drive conectado desde Ajustes → Apps conectadas.

## Errores y confusiones frecuentes

### "Falta cargar tus datos fiscales en Ajustes antes de poder facturar."

Este mensaje aparece si intentás facturar sin haber completado el perfil fiscal (Paso 1). Andá a Ajustes → Facturación AFIP y completá los campos que falten.

### El CUIT no se puede editar.

Es a propósito: una vez guardado, el CUIT queda bloqueado para evitar errores en tus facturas ya emitidas. Si necesitás cambiarlo, hay un botón específico para eso — no es un campo de texto libre que se pueda tocar sin querer.

### No sé si estoy en Homologación o en Producción.

Fijate en Facturación AFIP, en la sección de ambientes: el que dice "Activo" es el que se está usando en este momento para facturar. Si tenés dudas antes de emitir una factura real, el botón de emisión en la pantalla de Facturación también te lo aclara — dice explícitamente "Emitir factura real" cuando estás en Producción.

### Cargué mal mi usuario o clave fiscal y la vinculación falló.

Podés reintentar el Paso 2 las veces que necesites — no hay límite. Cada intento vuelve a pedirte la clave fiscal (porque, como se explicó arriba, nunca queda guardada).

### La vinculación se cortó a mitad de camino y no sé si quedó a medias.

No queda a medias. El Copiloto genera tu certificado con AFIP en un solo trámite automático; si algo se corta en el medio, el sistema lo detecta y te lo hace saber con un mensaje claro en vez de dejarte en un estado ambiguo. Si ya tenías una cuenta funcionando y un reintento posterior falla, tu vinculación anterior sigue activa — no se pierde por un intento fallido de actualizarla.

### ¿Por qué me pide usuario y clave fiscal si yo ya tengo Clave Fiscal en la web de AFIP?

Es el mismo usuario y clave que usás para entrar al portal de AFIP/ARCA por tu cuenta. El Copiloto los necesita una única vez para hacer el trámite de vinculación en tu nombre — no crea una cuenta nueva ni un usuario distinto del que ya tenés con AFIP.

### Mi certificado con AFIP venció, ¿qué hago?

El Copiloto te avisa de forma proactiva antes de que llegue a vencer: cuando falta menos de un mes, te llega un aviso —desde "Mi día"— diciéndote que tu certificado vence pronto y que conviene renovarlo antes de esa fecha para no quedarte sin poder facturar. Si ya venció, el aviso te lo dice igual de directo: mientras no lo renueves, no vas a poder facturar. Para renovarlo, repetís el trámite de vinculación del Paso 2 con tu usuario y clave fiscal de ARCA.

## Preguntas frecuentes

**¿Tengo que cargar mis datos fiscales cada vez que facturo?**
No. Los cargás una sola vez en Ajustes → Facturación AFIP y quedan guardados para todas las facturas futuras.

**¿El Copiloto guarda mi clave fiscal de AFIP?**
No, nunca. Se usa una sola vez para el trámite de vinculación y se descarta inmediatamente después.

**¿Puedo facturar como Responsable Inscripto con IVA discriminado?**
Todavía no. Podés cargar tu condición fiscal como Responsable Inscripto en Ajustes → Facturación AFIP, pero la Factura A o B con desglose de IVA no está disponible por el momento: hoy el Copiloto solo emite Factura C.

**¿Qué pasa si mi negocio tiene más de un punto de venta?**
Hoy la app admite un solo punto de venta por cuenta, el que cargás en Ajustes → Facturación AFIP. No hay forma de cargar ni elegir entre varios.

**¿Puedo tener Homologación y Producción vinculados al mismo tiempo?**
Sí. Podés vincular ambos ambientes para el mismo CUIT y cambiar entre ellos cuando quieras, sin tener que repetir el trámite de vinculación.
