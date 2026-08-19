# DECISIONES — 02 · Conexiones (el permiso se pide cuando hace falta)

Creado 29/07/2026 · **revisado 31/07** (el lane 2 pasa a la anatomía del 09) · `DECISIONES.md` escrito 31/07 — la carpeta no lo tenía, que es un requisito del proyecto.

La pantalla nace de la **Decisión A** (26/07): al mudar Conexiones adentro de Cuenta, deja de ser un tab y pasa a ser un destino de baja frecuencia. Eso obliga a dos cosas que este mockup demuestra: el permiso se pide **donde hace falta** (no en un setup inicial), y el estado de las conexiones tiene que **salir a la superficie** cuando algo se rompe.

## La tesis: conectar no es una pantalla de setup, es un momento de la conversación

- **Lane 1 — just-in-time consent** (IF Design Patterns Catalogue): el pedido del usuario choca con un servicio no conectado, Odobi lo dice y el permiso aparece en contexto, nombrando lo que desbloquea.
- **Lane 2 — la salvaguarda**: si una conexión se cae, no se entera sólo quien abre Cuenta. Hay tarjeta en Mi día y puntito en el avatar.
- **Lane 3 — el destino estable**: Cuenta › Conexiones, con alcance y corte a un tap.

## Timeline

Martes 21, 10:05 → 10:06 → 10:12. Dentro de la semana continua (lunes 20 → viernes 25) de 03/04/05/06/09, antes de la factura del jueves. Mercado Pago se cae y se reconecta desde la tarjeta.

## Lane 1 · El permiso llega con el pedido

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Disparador | Un pedido real del usuario («¿Cuánto entró esta semana?»), no un menú | Es lo que hace "just-in-time" al consentimiento: el permiso tiene un costo y acá tiene un beneficio inmediato y concreto enfrente | Wizard de conexiones en el onboarding — pide todo antes de que exista un motivo; el usuario acepta a ciegas o abandona |
| La negativa | «Eso no lo puedo ver todavía — no tenés conectado Mercado Pago. Si lo conectás, te respondo esa y te aviso cada cobro que entre.» | Guión §5 LITERAL. Regla de discurso: no sabe → lo dice, **con la salida en la misma frase**. Cero "no puedo ayudarte con eso" | Error seco sin salida — deja al usuario sin próximo paso; conectar en silencio — imposible y desleal |
| Sheet sobre la conversación | Sube encima del hilo, con scrim; el thread sigue detrás | Conectar no debe expulsarte a Ajustes y devolverte a reescribir lo que ya pediste. El contexto se conserva a la vista | Navegar a una pantalla de Ajustes — pierde el hilo y el motivo |
| Alcance en dos filas | Qué lee y qué escribe, en criollo y en verbos, con la condición al lado ("Solo lectura" · "Nunca sin tu OK") | Consentimiento informado antes de decidir — misma anatomía que el alcance del HITL (04). Los tiles arena son identidad, no tocables | Lista de scopes de la API — nadie la lee; "acceso a tu cuenta" — vago, pide fe |
| El permiso nombra lo que desbloquea | «Apenas conectes sigo con lo tuyo: **cuánto entró esta semana**.» | La pata que completa el patrón: no otorgás un permiso abstracto, pagás por una respuesta que ya querías | Sheet genérico reutilizable sin contexto — barato de construir, pero pierde justamente lo que lo hace legítimo |
| Un solo primario | "Conectar" (fill terracota) — lo único terracota del sheet | Decisión B: terracota = lo tocable que ejecuta. El verbo nombra el acto | "Aceptar" / "Continuar" — genéricos, no dicen qué pasa |
| "Ahora no" del mismo tamaño | Botón secundario de igual peso, vuelve al hilo | Negar no puede costar más que aceptar. La pregunta queda sin responder: honesto, no castigado | "Ahora no" chiquito o gris — dark pattern; bloquear hasta conectar — coerción |

## Lane 2 · Salvaguarda (revisado 31/07)

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| **Anatomía idéntica al 09** (rev. 31/07) | El lane dibujaba Mi día con clases propias: saludo display `.greet`, `.card` con `.card-head`, chips `.chip-act`. Pasa a **portada + `.aviso` + acción única**, las del 09, con gap del board 8 | Es la MISMA pantalla del 09. Dos anatomías para una sola pantalla en el mismo deck es exactamente la inconsistencia que el proyecto viene cazando (M2 fue eso mismo con la datacard) | Mantener el dibujo propio — "se ve bien igual", pero al ponerlas una al lado de la otra en el deck se nota que no es la misma app |
| Se cae el saludo "Buenas, Martín." | Eliminado | El 09 no tiene saludo — abre con la fecha (`.b-date`). Y M5 ya había eliminado el saludo display del chat por decorativo. No podía sobrevivir sólo acá | Conservarlo — reintroduce por la ventana lo que M5 sacó por la puerta |
| **La portada aparece, y admite estar incompleta** | Se agrega la portada (faltaba) con `$96.000` + la línea «faltan los cobros de hoy — Mercado Pago está caído» | Doble motivo: el 09 decidió que "la portada queda siempre — el libro a la vista"; y con Mercado Pago caído la cifra **no puede fingir estar entera** mientras una tarjeta dice que faltan cobros. Es la lección de C2 aplicada al revés: el tablero no puede contradecirse a sí mismo | Portada con número limpio — el tablero mentiría por omisión; ocultar la portada mientras hay una caída — esconder el libro justo cuando el usuario necesita entender qué le falta |
| Una sola acción por tarjeta | La tarjeta de la caída queda con **"Reconectá Mercado Pago →"**; se cae "Ver qué falta" | Regla del 09: más de una acción por tarjeta diluye. La acción abre el mismo sheet del lane 1 — un solo componente de consentimiento en toda la app | Dos chips — cómodo de dibujar, pero rompe el patrón en la pantalla que lo hereda |
| Segunda tarjeta: Gómez, no Fernández | Pasa a la factura A-0034 de **Gómez SRL ($120.000), vencida hace 27 días** | La anterior decía «El presupuesto de Fernández se enfría · **1 día**», y eso contradecía **dos** cosas del canon: la regla `presupuestos_enfriandose` dispara pasados los **30 días** (no 1), y en el 06 el presupuesto de Fernández se **aprueba** el viernes 25. Gómez cierra: es el mismo dato que "Por cobrar $120.000" y el mismo de 09/03. Aritmética verificable: 31 días el viernes 25 → **27** el martes 21 | Ajustar sólo el número de días de Fernández — seguiría chocando con el 06, donde ese presupuesto termina aprobado |
| Aritmética de la portada | 96 − 71 = 25 ✓ · Por cobrar 120 = la factura de Gómez ✓ | Continuidad verificable, como en el resto de los mockups | Cifras sueltas por pantalla — el deck pierde el hilo |
| Puntito en el avatar | Terracota, 10px, borde blanco | Salvaguarda 1 de la Decisión A: si Conexiones vive adentro de Cuenta, el estado tiene que salir a la superficie | Sólo la tarjeta — si el usuario no abre Mi día no se entera; badge numérico — promete una bandeja que no existe |
| La caída no secuestra la pantalla | Entra como una tarjeta más del día, encabezando la lista | Nielsen #1 (visibilidad del estado) sin bloquear. Encabeza porque le está costando plata que no ve | Modal al abrir la app — interrumpe antes de que el usuario sepa dónde está parado |

## Lane 3 · Cuenta › Conexiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Pantalla apilada, no tab | Se entra desde el avatar (Cuenta) y se vuelve con la flecha; breadcrumb "Cuenta" | Decisión A: patrón Gmail/YouTube. El breadcrumb dice dónde estás parado | Tab propio — vuelve a poner en máxima jerarquía algo de baja frecuencia |
| 6 servicios → 2 tarjetas | La lista se organiza por **permiso** (lo que el usuario otorga), no por integración técnica | Es la verdad del OAuth: Gmail/Calendar/Drive/Docs/Sheets son un solo consentimiento de Google. Los sub-textos nombran los servicios reales | 6 filas — mentiría sobre el flujo y volvería "dos minutos" una frase de marketing |
| Estado en píldora gris | "Al día" en crema/`sec`, no terracota | Decisión B: saber cómo está una conexión es feedback, no una acción | Píldora terracota — parecería tocable |
| El alcance se repite | Las mismas palabras del sheet, en la tarjeta | Lo que aceptaste en el momento se puede releer después, sin ir a buscar un PDF de términos | Link a "ver permisos" — esconde lo que debería estar a la vista |
| "Cortar" siempre visible | Una palabra, un tap | La revocación tiene que ser tan barata como el otorgamiento: es lo que hace legítimo pedir en contexto | Enterrar la baja en un submenú — patrón oscuro clásico |
| La consecuencia antes de la decisión | «Si cortás una conexión, antes te digo qué dejo de poder hacer. Nada se borra: dejo de mirar.» | Misma regla que el alcance del HITL (04): la consecuencia va antes. Y aclara lo que el usuario teme (que se borre algo) | "¿Estás seguro?" — pregunta vacía que no informa nada |
| Input+mic también acá | La barra no desaparece en Ajustes | Hablarle es la vía principal en cualquier pantalla: "cortá Mercado Pago" también se puede decir | Ocultarlo en pantallas de configuración — degrada el canal identitario justo donde hay fricción |

## Contrastes (calculados)

`#1A1512` s/blanco ✅ · `#1A1512` s/crema 16.37:1 ✅ · `#5C534C` s/blanco 7.51:1 ✅ (estados, sub-textos, `.p-partial` en crema 6.79:1 ✅) · `#B04A2E` s/blanco 5.43:1 ✅ (acciones de tarjeta, "Cortar", links) · `#1A1512` s/arena-30 14.56:1 ✅ (íconos en tiles) · blanco s/`#DE7250` 3.17:1 ✅ AA texto grande (botón "Conectar", display 20 Bold — regla 28/07 v2) y sólo gráficos para el mic (1.4.11).

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ lane 1 ≈4% · lane 2 ≈5% · lane 3 ≈4%.
2. WCAG AA calculado → ✅ pares arriba.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos → ✅.
4. Voseo, sin léxico prohibido, §5 → ✅ («Eso no lo puedo ver todavía…», «Reconectá», «Reclamá el pago», «dejo de mirar»).
5. Cero orbes/glow/glassmorphism → ✅ (el scrim del sheet es un velo plano, no glass).
6. Caja "Odobi" correcta → ✅.
7. Grilla 8pt, thumb zone, targets ≥44pt → ✅ (acciones 48pt, "Cortar" 48pt, botones del sheet 48pt).
8. Decisiones con fundamento citable → ✅ estas tablas.

## Pendiente

- **Sección Cuenta como pantalla propia**: el lane 3 muestra Conexiones *dentro* de Cuenta, pero Cuenta como índice (plan, datos, cerrar sesión) todavía no está dibujada. Le toca al **08**, que se accede desde el mismo avatar.

---

## Revisión 16/08 — se retira la tabbar

Conexiones no cambia de naturaleza: sigue siendo una **pantalla apilada a la que se entra por el avatar (Cuenta)** y de la que se vuelve con la flecha. Lo que cambia es el argumento de por qué no compite en la nav: antes se apoyaba en "no es una de las 3 tabs"; ahora, en que **el avatar es la única puerta** — y por eso el punto de estado en el avatar y la tarjeta de conexión caída en Mi día dejan de ser adornos y pasan a ser las salvaguardas que sostienen la decisión.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
