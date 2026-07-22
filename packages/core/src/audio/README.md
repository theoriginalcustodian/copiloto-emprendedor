# `core/audio` — la captura de audio, sin plataforma

**Cero DOM, cero React, cero I/O.** Esta capa es TypeScript puro y **sobrevive a la decisión de formato
de la app** (web / Capacitor / React Native). Cuando esa decisión se tome, este directorio se mueve a un
paquete compartido sin tocar una línea.

> ⚠️ **Si algo acá importa `react`, un componente, `fetch`, `localStorage` o cualquier API del
> navegador, está mal ubicado.** Esa es la única regla de la carpeta, y es la que le da valor.

🔴 **Adaptado del `core/audio` del proyecto de origen (decisión D6 del plan de puertos móviles): de los
5 puertos originales (grabador, almacén, índice, hasher, purgador) queda SÓLO el grabador.** Este
producto no retiene audio en el dispositivo — el dictado va directo a Groq (`api/audio.ts`) y vuelve
como texto. `AudioStore`, `IndiceLocal`, `Hasher` y `Purgador` (y sus tipos/tests exclusivos) se
descartaron con su persistencia; `panelMachine.ts` (la máquina de estados del panel, con sus 18 tests)
tampoco se portó — es lógica de UI atada al flujo clínico de origen (bloqueo por borrador pendiente,
tipo de nota elegido antes de grabar) que hay que reconstruir contra el flujo real de este producto, no
heredar mecánicamente.

| Archivo | Qué es |
|---|---|
| `types.ts` | El dominio que sobrevive: sesión, segmentos, fuentes, avisos. |
| `ports.ts` | El contrato que sobrevive: `AudioRecorder` (+ `GuardiaInterrupciones`/`RastroProteccion`/`RegistroProteccion`, la protección "No molestar"). |
| `nivel.ts` | El nivel de amplitud para la onda mientras se graba. Función pura. |
| `nivel.test.ts` | Tests de `nivel.ts`. |

---

## Por qué existe

En el proyecto de origen, la lógica de grabación vivía enredada con el DOM y duplicada entre dos
componentes. Extraerla a un núcleo puro paga esa deuda **y** hace que la migración entre formatos de
app no la toque — la parte de este conocimiento que es agnóstica de dominio (interrupciones del SO,
foreground services, recuperación de huérfanos) es exactamente igual de válida para un dictado de
negocio que para una consulta médica.

---

## Las tres cosas que la investigación de origen (2026-07-13) obliga a diseñar así

**1 · El grabador produce SEGMENTOS, no un archivo.**
Ninguna librería del ecosistema RN/Expo sobrevive hoy a una interrupción real: `expo-audio` (y `expo-av`
antes) **pierde el audio previo cuando entra una llamada** — bug abierto, con causa raíz conocida (atiende
`interruptionBegan`, nunca `interruptionEnded`). El patrón de la industria es segmentar y unir al final.
**El merge puede cambiar el contenedor** (`aac` → `audio/mp4`): por eso `ArchivoAudio` lleva su `mime`
explícito y nadie aguas abajo lo asume.

**2 · No podemos impedir que el SO nos mate. Podemos impedir que sea catastrófico.**
Los OEM agresivos (Xiaomi, Huawei, Samsung) matan servicios aun con foreground service, y **no hay API
para evitarlo**. Como los segmentos se escriben a disco *mientras* se graba, un kill deja huérfanos
recuperables: **se pierde la cola, no la consulta.** De ahí `AudioRecorder.recuperarHuerfanos()`.

**3 · Las capacidades se consultan, no se asumen.**
La diarización por canal (2 micrófonos, uno por persona → separación determinística) es una **mejora
opcional**, no una dependencia. Con `canales === 1` se graba igual y se diariza probabilísticamente. Colgar
el producto de un hardware sin verificar sería codificar la esperanza.
⚠️ **La trampa:** los receptores (DJI Mic Mini, Rode Wireless GO 3) dan 2 canales **solo en modo
Stereo/Split**; en modo Merge **mezclan en el hardware**. El usuario puede creer que graba 2 canales y
grabar 1 — por eso el conteo se lee del dispositivo y se levanta el aviso `un_solo_canal`.

---

## Los fallos silenciosos (los que no lanzan excepción y degradan la consulta sin síntoma)

`AvisoCaptura` existe para que **el usuario se entere**:

- `un_solo_canal` — la diarización cae a probabilística.
- `ruta_cambiada` — el micrófono externo se desconectó **a mitad de la grabación**. La detección
  (`routeChangeNotification` / `AudioDeviceCallback`) **no es 100% confiable**: hay un bug documentado de
  Apple donde la notificación no dispara. Requiere verificación activa, no sólo escuchar el evento.
- `interrumpido` — una llamada cortó la captura.
- `sin_background` — el grabador **no** captura con la pantalla bloqueada (es el caso de la web pura).

---

## Lo que falta (y por qué no está)

Los **adaptadores** (la implementación de `AudioRecorder`/`GuardiaInterrupciones`) **no se escriben
hasta que se decida la plataforma** — son exactamente lo que cambia entre web, Capacitor y React
Native. El contrato, no.

La **retención/purga de audio** (los 4 puertos descartados) queda fuera de alcance mientras el producto
no persista audio localmente; si esa decisión cambia, hay que re-diseñarla contra el flujo real de este
producto, no reflotar los tipos descartados.
