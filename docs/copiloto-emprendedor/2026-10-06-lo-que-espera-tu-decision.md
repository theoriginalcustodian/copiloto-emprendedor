# Lo que espera tu decisión — 2026-10-06

**Las tuyas son 4.** Las de sesión eran 2 cuando preguntaste y **ahora son 5**: el deploy de hoy
destapó tres (`HEALTHZSHA` — `/healthz` miente sobre la versión desplegada, `DURABGATE` — el
gate de durabilidad no frena, `DRIVECERO` — Drive se conecta y no hace nada). Las cinco están
asignadas y moviéndose: `VERIFPRODWEB` → frontend2 · `MOBILEVIVO` → frontend1 · las tres
nuevas → backend.

🔻 **Corrijo el número que te di hace un rato:** dije «4 de 6» y en la misma hora pasó a «4 de
9». **Lo tuyo no cambió** — cambió cuánto se está moviendo del otro lado.

Las cuatro de abajo **ninguna sesión puede moverlas**, y por eso están paradas.

De las cuatro, **una sola bloquea producto**. Las otras tres no frenan la beta: están acá para que no
se cierren solas por olvido.

| # | Qué | Fila | ¿Bloquea la beta? | Qué necesito de vos |
|---|---|---|---|---|
| 1 | Texto legal definitivo | `CIERREB` (BL-O6) | **SÍ** | el texto, **o** «sale con el aviso puesto» |
| 2 | Qué hace la app si la versión aceptada ≠ la vigente | `LEGALNOOPERA` (b) | no | **v1** o **v2** (recomiendo v2) |
| 3 | Proveedor SMTP + DNS | `SMTPPREP` (1) | no | nombre del proveedor |
| 4 | `gh pr merge 10 --merge` en `fleet-platform` | `BLO4OUT` | no (otro repo) | un clic, **no es una decisión** |

---

## 1. Texto legal definitivo — la única que bloquea producto

El mecanismo está **entero y vivo en prod**, medido hoy por auditoría contra el proceso real:
`GET /me` devuelve `legal_version_aceptada = '2026-09-22'`, la versión vencida da 409
`version_desactualizada`, sin token da 401 y un tenant nuevo arranca en `legal_aceptado=false`.
Falta **sólo el texto** de ToS/Privacidad, y retirar el aviso «plantilla genérica»
(`apps/copiloto-web/src/auth/LegalScreen.tsx:125`).

**Por qué es tuya y no de una sesión:** describir el tratamiento de datos es un hecho técnico y lo
hace frontend2. **Quitar ese aviso afirma que el documento ya es legalmente real**, y eso tiene
consecuencias fuera del repo que ninguna sesión puede asumir por vos. El aviso sigue puesto por
decisión explícita tuya, no por descuido: no lo contamos como deuda.

→ **Las dos respuestas son válidas:** entregás el texto, o declarás que la beta sale con el aviso
puesto. La que no existe es no responder, porque todo lo demás ya está hecho y desplegado.

## 2. Comportamiento cuando la versión aceptada ≠ la vigente

- **v1** — re-pedir la aceptación. Es para lo que existe el versionado.
- **v2** — sólo mostrarla en Mi cuenta, sin forzar nada.

**Ya no hay trabajo técnico pendiente en v2:** el backend expone la versión (`web.py:641`
`_campos_legales`) y Mi cuenta la muestra con sus tres estados distinguidos (#836, `6d465926`),
ambos desplegados y verificados en prod hoy. Así que esto es **puro producto**: qué querés que le
pase al usuario.

→ **Recomiendo v2 para la beta**, y el motivo es el ítem 1: forzar la re-aceptación de un documento
que vos mismo declaraste «plantilla genérica» le afirma al usuario algo que el repo no sostiene.
**v1 entra el día que entre el texto** — es el mismo endpoint, ya existe.
Nota: mobile **no conoce** el campo (0 hits en `apps/mobile/src`) y mobile está fuera de sprint por
tu orden; queda nombrado, no asignado.

## 3. Proveedor SMTP + DNS

Las partes (2) y (3) —exponer el path real de GoTrue en Caddy y revisar `API_EXTERNAL_URL` sin
romper el callback de Google— **ya están mergeadas** (backend, #831 `ce95d53f`). El camino quedó
listo y **mudo**: no hay mail que probar hasta que haya proveedor.

→ **Tuyo es sólo elegir proveedor y cargar SPF/DKIM.** Decime el nombre y queda andando.
⚠️ Y el orden importa: cargar el SMTP **sin** las partes 2 y 3 habría dado mails con el link roto,
que es peor que no tener mails. Por eso se hicieron primero.

## 4. `fleet-platform` #10 — un clic, no una decisión

PR `OPEN`/`MERGEABLE` desde el 2026-09-29. Es el fix de raíz de `inject_alert_receiver()`: el
receiver se appendeaba **después** de `inhibit_rules:`, así que `route.receiver` apuntaba a un nombre
que `receivers:` nunca contenía ⇒ **el mecanismo de alertas de la flota nunca se ejercitó
end-to-end**.

**Por qué te lo paso recién ahora, y por qué estuvo 7 días parado por culpa nuestra:** quedó escrito
como «falta que el operador lo mergee», que es exactamente el anti-patrón que marcaste el 2026-08-06
— un gate mecánico que frena a una sesión es problema de la sesión. Se lo devolví a backend como
bloqueo propio y **lo midió**: reintentó con `--match-head-commit`, PR en `CLEAN`, y el clasificador
del host denegó igual. **Dos intentos, dos denegaciones**, sin rodearlo por otra vía. Y se descartó
la hipótesis que podía salvarlo: hoy el mismo clasificador dejó mergear al **dueño** de un PR y
bloqueó a un tercero — pero #10 lo abrió backend y aun así se lo deniegan.

→ **La frase completa:** en `fleet-platform`, `gh pr merge 10 --merge`.

---

## Lo que NO está acá, para que no lo decidas dos veces

- **`BL-O4` (alertas v1 vs v2): ya lo decidiste el 2026-09-29** — sale del sprint. Si algún archivo
  te lo vuelve a pedir, es texto viejo: ignoralo.
- **Testers:** tuyo end-to-end, no hay nada que preparar de nuestro lado. No lo subo como decisión.
- **`BL-X6`** (acta de DEC-5 + los 11 `.otf` en la historia del repo público): no urgente, no bloquea
  la beta — es licenciamiento, no un secreto. Recomiendo **acta ahora, `filter-repo` nunca**, salvo
  que el licenciante lo exija: reescribir la historia de un repo público rompe todos los SHA citados
  en ADRs y memoria.
- **`npm ci` del checkout compartido** y el descarte de los cambios locales (`WIPCOMPART`): son
  cosméticos y el riesgo de producto ya está cerrado por código (`deploy.sh:37` + `:56-68` abortan
  dos veces contra ese checkout, medido). Lo hace frontend2 cuando toque; no te lo pido.

**DoD de este archivo:** con los ítems 1 y 2 respondidos, `CIERREB` se parte en filas con dueño de
sesión y vuelve a `pendiente`. Los ítems 3 y 4 no bloquean nada: entran cuando los resuelvas.
