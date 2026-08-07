# Base de conocimiento de usuario — «Cómo usar la app»

> **Qué es esto:** el corpus que alimenta al **agente de soporte** (función *cómo uso la app*) vía el
> RAG de fusion. **No es documentación interna.** El lector es un emprendedor, no un desarrollador.
>
> **DoD del sprint:** [`../Soporte tecnico - basico/01-DOD-sprint-agente-de-soporte-tecnico.md`](../Soporte%20tecnico%20-%20basico/01-DOD-sprint-agente-de-soporte-tecnico.md) §2.A.
> **Verificación:** `bash scripts/kb-corpus-check.sh` — corre antes de cada ingest.

---

## Por qué existe, y por qué la forma importa tanto

El agente de soporte usa **GPT-4o-mini**, un modelo chico. Un modelo chico es más propenso a sostener
con seguridad algo que el contexto no dice — así que **la calidad de la respuesta depende más del
corpus que del modelo**. La causa raíz medida del over-refusal en el pipeline de fusion no fue la
síntesis: fue **el chunking del corpus**.

Traducido: un documento sin headers reales, o con seis temas mezclados, no produce «una respuesta un
poco peor». Produce que el retrieval traiga el chunk equivocado y el agente conteste sobre otra cosa,
o no conteste nada.

## Las reglas de forma (no son estilo)

| Regla | Por qué |
|---|---|
| **Jerarquía de headers real** (`#` › `##` › `###`) | El header entra como contexto del chunk. Sin él, el chunk pierde el «de qué habla» |
| **Un tema por documento**, título descriptivo | El título participa del ranking; un doc multi-tema contamina el top-K |
| Cada `##` **responde solo** una pregunta | Es la unidad que el usuario va a recibir. Si necesita el resto del doc, falla |
| **Prosa antes que bullets sueltos** | Un bullet aislado no se sostiene como respuesta y el verificador de grounding lo castiga |
| **Markdown**, nunca PDF ni HTML | El chunker es header-aware sobre Markdown |
| Español rioplatense, sin jerga técnica | Nada de nombres de archivos, funciones, endpoints ni tablas |
| **Cero PII, cero datos de tenant** | El corpus va a un índice compartido |

## Lo que NUNCA va en este corpus

- **Datos del negocio de nadie** (facturas, clientes, montos). Eso vive en la base con RLS y se
  consulta **por SQL con el tenant declarado**, jamás por retrieval. Si alguna vez se pide «que el
  agente sepa mis facturas», la respuesta es una herramienta, no ingestar.
- Emails, IPs, hostnames, rutas absolutas, credenciales.
- Documentación de ingeniería: decisiones de arquitectura, post-mortems, ADRs. Eso es el **otro**
  corpus (soporte técnico interno), con otro público y otro criterio de selección.

## Los documentos

Uno por función real de la app, verificado contra el código:

| Documento | Cubre |
|---|---|
| `facturacion.md` | Emitir comprobantes AFIP |
| `presupuestos.md` | Armar y enviar presupuestos |
| `clientes.md` | Alta y gestión de clientes |
| `ingresos.md` · `gastos.md` | Registrar movimientos |
| `contabilidad.md` | La vista contable |
| `actividad.md` · `recientes.md` | Qué pasó en el negocio |
| `inteligencia.md` | Análisis e insights |
| `midia.md` | Mi día |
| `chat.md` | Hablarle al copiloto — **la función central** |
| `dictado-por-voz.md` | Cargar cosas hablando |
| `apps-conectadas.md` | Gmail, Drive, Sheets, Calendar |
| `escritorio.md` | La pantalla principal |
| `ajustes.md` | El menú de configuración |
| `mi-negocio-y-afip.md` | Perfil del negocio y datos fiscales |
| `entrar-y-tu-cuenta.md` | Login, sesión, plan |

## Los marcadores `<!-- VERIFICAR -->`

Un documento puede contener `<!-- VERIFICAR: ... -->` donde quien lo escribió **no pudo confirmar algo
contra el código**. Eso es deliberado y es preferible a inventar: un documento que describe una
función inexistente le miente al usuario y contamina el índice.

**Ninguno de esos marcadores puede sobrevivir al ingest.** Se resuelven leyendo el código o probando
la app; el gate los cuenta y el DoD exige que estén en cero antes de A4.

## Cómo se mantiene

**Cuando cambia una función de la app, cambia su documento en el mismo PR.** Un corpus que envejece es
peor que no tenerlo: el agente responde con confianza algo que dejó de ser cierto, y el usuario actúa
sobre eso. Es el mismo criterio con que este repo trata los instrumentos que mienten.

Tras cualquier cambio: re-ingestar y **volver a correr el spike de retrieval**, no sólo el ingest.
