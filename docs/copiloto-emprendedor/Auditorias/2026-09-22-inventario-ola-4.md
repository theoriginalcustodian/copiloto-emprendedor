# Inventario de la Ola 4 — entrada para AUDITORÍA (A4)

> Generado por `scripts/inventario-ola.sh --ola 4` el 2026-09-22.
> **SHA de `main` al momento de generarlo: `b76cb47b`.** Cada fila re-medida por auditoría
> lleva el SHA que midió; si `main` avanzó, el veredicto es sobre ESTE SHA, no sobre «lo último».
> Auditoría **no explora fuera de estas rutas**: si algo falta acá, falta en el inventario, no en la app.

## 1. PR mergeados en la ventana (desde 2026-09-21)

| PR | SHA de merge | Título | Filas que cita | Archivos |
|---|---|---|---|---|
| #514 | `e6544f3b` | chore(gitignore): ignora credenciales sueltas y archivos locales | - | 1 |
| #515 | `904dbb5a` | docs: backlog completo de la beta de odobi con dod por ítem | - | 1 |
| #516 | `fa090362` | design(prototipo): odobi-ui al día + las tres decisiones del 18/09 | - | 30 |
| #517 | `02c5e0db` | docs: plan de implementación autónomo de la beta odobi | - | 12 |
| #518 | `0ecd38ec` | docs(plan): script-first y segundo plano (§5.7) | - | 1 |
| #519 | `5ec87b8e` | chore(coordinacion): comando de arranque de la sesión auditoría (BL-P8) | `BL-P8` | 1 |
| #520 | `89373be2` | ci: gate aislado por sesión + guard de congelamiento nativo + deploy desde origin/main (BL-B6/BL-B7) | `BL-B6`, `BL-B7` | 8 |
| #521 | `a142cf56` | feat(web): desconectar apps, descripción por capacidad, origen del gasto y ARCA (BL-C1/W2/C4/X5) | `BL-C1`, `BL-C4`, `BL-W2`, `BL-X5` | 26 |
| #522 | `3d25dff8` | feat(presupuestos): idempotencia del alta con idem_key (K-01 backend) | `K-01` | 9 |
| #523 | `59d084e7` | feat(chat): HITL mobile completo + cancelar voz deslizando (BL-D3, BL-D2) | `BL-D2`, `BL-D3` | 13 |
| #524 | `698f9b66` | feat(midia): portada, vacío con Calma y chips en web (BL-W8/W5/W7) | `BL-W5`, `BL-W7`, `BL-W8` | 18 |
| #525 | `41f26da4` | fix(deploy): sync-web tolera el .otf externo ausente en wt-deploy | - | 1 |
| #526 | `023422ce` | feat(chat): separadores de día en el historial (BL-C3) | `BL-C3` | 15 |
| #527 | `e629a3bd` | feat(web): CAE, número, vencimiento y PDF en la card de factura (BL-C2) | `BL-C2` | 2 |
| #528 | `e5b2688e` | feat(web): logos reales, isotipo y login del prototipo (BL-X11 + BL-X12w) | `BL-X11`, `BL-X12w` | 15 |
| #529 | `b3d5eeda` | feat(web): Pausar/Reanudar/Eliminar/Enviar en la grabación fijada (BL-W1) | `BL-W1` | 5 |
| #530 | `c1a802bc` | feat(afip): 409 cuit_no_vinculado inline sobre el campo CUIT (BL-C6, mitad FE de K-02) | `BL-C6`, `K-02` | 4 |
| #531 | `178d3bf8` | docs(plan): triada backend en 55435, filas BL-X12m/BL-X12w y tamaño de la matriz | `BL-X12m`, `BL-X12w` | 1 |
| #532 | `8492cd2a` | feat(chat): rodillo de ejemplos pausable y quieto con movimiento reducido (BL-W4) | `BL-W4` | 8 |
| #533 | `626dcddb` | feat(web): armazón en capas — abre en Mi día y Ajustes solo por el avatar (BL-X1) | `BL-X1` | 14 |
| #534 | `2815b9e8` | chore(auditoria): instrumento que arma el inventario de una ola (A1..A4) | - | 1 |
| #535 | `f1ef2c9d` | feat(chat): tarjeta del link de cobro de MercadoPago en mobile (BL-F2) | `BL-F2` | 7 |
| #537 | `03f479ab` | feat(ayuda): «Cómo uso la app» abre el chat principal con la pregunta precargada (BL-W9) | `BL-W9` | 18 |
| #538 | `65c4a334` | feat(afip): rechazar CUIT no vinculado en POST /afip/perfil (K-02 backend) | `K-02` | 7 |
| #539 | `1fb38509` | feat(midia): fecha de corte y variación del saldo en la portada (BL-J2, BL-J3; FE de K-03) | `BL-J2`, `BL-J3`, `K-03` | 12 |
| #540 | `e63acb5a` | feat(inteligencia): fecha_corte y variacion_pct en caja de la portada (K-03) | `K-03` | 4 |
| #541 | `e1b0fc38` | feat(clientes): chip de cartera desde el agregado del backend (BL-J6) [PENDIENTE_INTEGRACION] | `BL-J6` | 6 |
| #542 | `216f8894` | feat(clientes): agregados_este_mes en GET /clientes (K-04) | `K-04` | 4 |
| #543 | `9048d883` | feat(presupuestos): idem_key y estado terminal persistido en mobile (BL-D1) | `BL-D1` | 8 |
| #544 | `5e5ac4ed` | fix(coordinacion): el escalador de en-curso medía desde que se escribió el contrato, no desde que se tomó | - | 1 |
| #545 | `8a79f334` | feat(negocio): teléfono y email del negocio (BL-J10) [PENDIENTE_INTEGRACION] | `BL-J10` | 9 |
| #546 | `b5787c14` | feat(perfil): telefono y email del negocio (K-05) | `K-05` | 6 |
| #547 | `732dfb5f` | feat(mi-dia): categoria, criticidad y verbo por regla (K-06) | `K-06` | 3 |
| #548 | `f1a50a93` | feat(midia): categoría, criticidad y verbo por regla + banner crítico (BL-J5) [PENDIENTE_INTEGRACION] | `BL-J5` | 13 |
| #549 | `fe1903a6` | fix(coordinacion): el gate daba por ausente al rol que trabajaba en vez de reportar | - | 6 |
| #550 | `e8564d4a` | feat(fe): salud por conexión, portada incompleta y punto del avatar (BL-J4, K-09) [PENDIENTE_INTEGRACION] | `BL-J4`, `K-09` | 24 |
| #551 | `367f912d` | feat(web): BL-W3 — pantalla «Contanos qué tal» (texto, voz, derivación a Soporte) | `BL-W3` | 8 |
| #552 | `fc583792` | feat(copiloto): salud por conexión (K-09) | `K-09` | 21 |
| #553 | `5d75cc74` | feat(soporte): BL-W10 — tiempo de respuesta sin número y qué viaja con el ticket (web + mobile) | `BL-W10` | 7 |
| #554 | `7436c343` | feat(fe): cambiar contraseña y email en Mi cuenta (BL-J11, K-12) [PENDIENTE_INTEGRACION] | `BL-J11`, `K-12` | 12 |
| #555 | `e2056961` | feat(copiloto): ejemplo de tono (K-15) | `K-15` | 4 |
| #556 | `97c2653a` | feat(inteligencia): BL-W6 — estados textuales del refresco (web + mobile) | `BL-W6` | 10 |
| #557 | `4ad90e95` | fix(coordinacion): el janitor archivaba los hallazgos de auditoría sin que nadie los leyera | - | 2 |
| #558 | `a8e83e38` | feat(copiloto): flag de onboarding (K-14) | `K-14` | 6 |
| #559 | `2020a32b` | feat(copiloto): cambiar contraseña y mail (K-12) | `K-12` | 15 |
| #560 | `6d2726b8` | feat(fe): pantalla «Cómo hablarle» con ejemplo de respuesta (BL-X7, K-15) [PENDIENTE_INTEGRACION] | `BL-X7`, `K-15` | 13 |
| #561 | `c0fe3911` | fix(copiloto): guardas del CI rotas por K-12 (#559) | `K-12` | 3 |
| #562 | `e23bba76` | feat(chat): BL-F1 — componente Recibo compartido + aviso de nota de crédito (web + mobile) | `BL-F1` | 18 |
| #563 | `2bebe393` | feat(fe): onboarding de dos permisos y primer insight (BL-X8, K-14) | `BL-X8`, `K-14` | 14 |
| #564 | `319d6136` | feat(copiloto): sugerencias tras guardar/aprobar presupuesto (K-07 backend) | `K-07` | 5 |
| #565 | `726ae4ac` | fix(coordinacion): el escalador no puede callarse ni inundar cuando no pudo medir | - | 3 |
| #566 | `0bd012a4` | fix(fe): no montar «Cambiar email» hasta el Cierre B (BL-J11, K-12) [DIFERIDO_CIERRE_B] | `BL-J11`, `K-12` | 4 |
| #567 | `51ee9931` | feat(copiloto): «Lo pediste vos» — feedback propio y escuchado (K-08 backend) | `K-08` | 8 |
| #568 | `49ef27d8` | feat(tema): BL-X4 dos pieles + «Como el teléfono» que sigue al sistema (web y mobile) | `BL-X4` | 15 |
| #569 | `b7323090` | docs(auditoria): auditoría A1 de la ola 1 @ fc583792 | - | 2 |
| #570 | `8321789c` | feat(copiloto): gate requiere_conexion estructurado (K-11 backend) | `K-11` | 8 |
| #571 | `a3f8716f` | fix(planificacion): inventario de ola mide mitades y adelantadas; dod corregido post-a1 | - | 3 |
| #572 | `f8f25662` | fix(login): wordmark Odobi en color acento (seguimiento BL-X11) | `BL-X11` | 1 |
| #573 | `04e7ca06` | feat(copiloto): POST /transcribir sin despachar al agente (K-10, BL-J7 backend) | `BL-J7`, `K-10` | 2 |
| #574 | `1f787a15` | test(afip): test web de K-02 — 409 cuit_no_vinculado inline (cierra BL-C6 web, reabierto por A1) | `BL-C6`, `K-02` | 2 |
| #575 | `f9ef6f0c` | fix(vigilancia): ve las sesiones lanzadas desde worktrees y sus marcadores con tilde | - | 2 |
| #576 | `ee1ebf17` | fix(chat): BL-D3 logo real en el gate HITL mobile + BL-C3 test del separador (reapertura A1) | `BL-C3`, `BL-D3` | 2 |
| #577 | `689b5321` | fix(gate): arg invalido es exit 2 y el recibo acumula por job (A1 4.1-4.4) | - | 3 |
| #578 | `85becff9` | feat(fuentes): BL-X6 Plus Jakarta Sans + Inter en toda la web, retira Neue Einstellung | `BL-X6` | 4 |
| #579 | `bc04bac2` | fix(inventario): sin \r de python en la salida y test sin `/ grep -q` | - | 2 |
| #580 | `6b3abc79` | fix(copiloto): ARCA en lo que ve el usuario, sin AFIP suelta (BL-X5 backend) | `BL-X5` | 18 |
| #581 | `30f47da2` | test(web): BL-Q4 — barrido de contraste de pares pintados (mitad web) | `BL-Q4` | 1 |
| #582 | `4802e08b` | fix(contraste): BL-Q4 botón de grabar legible (1,26:1 → 5,43:1) y gate que lo fija | `BL-Q4` | 3 |
| #583 | `57e5e8a4` | fix(inventario): la mitad backend de una junta se mide por su contrato k | - | 2 |
| #584 | `45fc25cc` | fix(vigilancia): el paso cola lee el plan del buzón vigilado, no el del worktree | - | 3 |
| #585 | `832f4537` | feat(copiloto): agenda por rango y grupos + ADR-004 (K-13, BL-J13 backend) | `BL-J13`, `K-13` | 3 |
| #586 | `2c247335` | feat(inteligencia): BL-X3 «Preguntar» abre el chat principal durable, sin mini-chat | `BL-X3` | 16 |
| #587 | `5f97938d` | feat(web): BL-X2 — seis funciones y fusión Contabilidad → Inteligencia | `BL-X2` | 18 |
| #588 | `63c49cc9` | feat(presupuestos): BL-J9-FE chip «Mandalo por mail» tras guardar con Doc (K-07 mitad A) | `BL-J9`, `K-07` | 12 |
| #589 | `c40a662c` | feat(feedback): BL-J12-FE «Lo pediste vos» web+mobile + marcar escuchado (admin) | `BL-J12` | 15 |
| #590 | `cff0c293` | fix(vigilancia): una corrida del sdk no es una ventana sin rol | - | 2 |
| #591 | `b76df7d3` | test(copiloto): adversarial de agenda con rango y gate HITL de calendar_book (K-13) | `K-13` | 2 |
| #592 | `8e2f45f6` | fix(afip): ventana de vida de 24 h para el borrador de factura sin confirmar (BL-B2) | `BL-B2` | 5 |
| #593 | `9300dd70` | fix(inventario): la ventana se pide por fecha y el tope aborta en vez de truncar | - | 1 |
| #594 | `76aa19b6` | feat(chat): BL-J8 sheet de consentimiento en contexto para requiere_conexion (K-11) | `BL-J8`, `K-11` | 15 |
| #595 | `80f2a5e6` | feat(copiloto): card sugerencia_armar_factura al aprobar un presupuesto (K-07-B, BL-J9) | `BL-J9`, `K-07` | 3 |
| #596 | `1aa24ae7` | feat(agenda): BL-J13 agenda de varios días + «Nuevo evento» por el chat (web+mobile) | `BL-J13` | 17 |
| #597 | `cd845d1b` | feat(auth): reveal de entrada y textos de ingreso (BL-X12m) | `BL-X12m` | 12 |
| #598 | `41cc99ed` | fix(inventario): falla cerrado si la lista de PR no se puede leer | - | 2 |
| #599 | `fef68837` | docs(coordinacion): filtro del vigía ve destinatarios compuestos y dod de bl-j13 con los títulos reales | `BL-J13` | 2 |
| #600 | `c15eb0f9` | docs(adr): ADR-001 dice una sola cosa — mirror no verificado, gate manual en la beta (BL-B5) | `BL-B5` | 1 |
| #601 | `245fc3f2` | ci(seguridad): gitleaks fijado en pre-push y lint.sh, con control positivo/negativo (BL-B3) | `BL-B3` | 7 |
| #602 | `6b410923` | feat(chat): chip para armar la factura desde la sugerencia (BL-J9) | `BL-J9` | 9 |
| #603 | `fadc6ef1` | feat(deploy): durabilidad HITL cableada en deploy.sh (BL-B1) | `BL-B1` | 3 |
| #604 | `a8fc298e` | docs(auditorias): auditoría A2 de la ola 2 y fe de erratas de A1 §1.2 | - | 2 |
| #605 | `5d7c1b1f` | fix(escaladores): el cache del avance por frente no cacheaba | - | 2 |
| #606 | `0eb1079f` | docs(a2): dod de bl-j9/j11/x6 y chequeo anti falso verde del inventario tras la auditoría | `BL-J11`, `BL-J9`, `BL-X6` | 2 |
| #607 | `98a5d44b` | fix(chat): A2/K-07-B — gana la card que bloquea, no la última en llegar | `K-07` | 6 |
| #608 | `4ecf4e4c` | fix(auth): mapear 400 cuenta_sin_email en cambiar-contrasena (BL-J11 K-12) | `BL-J11`, `K-12` | 2 |
| #609 | `de1a1f5e` | feat(mic): chip de duración por voz (BL-J7/K-10) + BL-Q4 cobertura contraste + BL-J12 admin escuchado persistido | `BL-J12`, `BL-J7`, `BL-Q4`, `K-10` | 22 |
| #610 | `27e73a4d` | fix(auth): BL-J11 K-12 — GoTrue de test efímera real, no mock | `BL-J11`, `K-12` | 6 |
| #611 | `eed48539` | docs(bl-p5): cada pantalla del prototipo clasificada spec, visión, propuesta o fuera | `BL-P5` | 2 |
| #612 | `1fc8a0b9` | feat(ci): BL-Q1 — gate de paridad testID/data-testid por pantalla, con trinquete | `BL-Q1` | 5 |
| #613 | `361d4ab9` | docs(plan): renumera bl-v16/bl-v17 y espeja la memoria de device | `BL-V16`, `BL-V17` | 3 |
| #614 | `63fd6f15` | feat(bl-j7): mic en la fila del rótulo de gastos/ingresos/presupuestos/clientes | `BL-J7` | 20 |
| #615 | `e91ec24c` | feat(gastos): POST /gastos/leer-foto -- OCR de ticket sin chat (BL-J7 3er ítem) | `BL-J7` | 2 |
| #616 | `b704a685` | feat(BL-X10/BL-X12w): animación de identidad de entrada (splash) + reveal post-logout, web+mobile | `BL-X10`, `BL-X12w` | 30 |
| #617 | `b59588d2` | fix(ci): testid_paridad excluye archivos de test del escaneo (bloqueaba #616) | - | 3 |
| #618 | `debf962f` | fix(bl-x5): últimos strings AFIP -> ARCA en backend + kb-usuario | `BL-X5` | 2 |
| #619 | `4e9cdad3` | feat(gastos): foto del ticket como disparador directo, sin chat (BL-J7 3er ítem DoD) | `BL-J7` | 12 |
| #620 | `6c839bd4` | docs(backlog): bl-j7 dod corregido por k-10 y bl-v17 en 484 excepciones | `BL-J7`, `BL-V17`, `K-10` | 3 |
| #621 | `ed4e31c0` | fix(inventario): lee los códigos de fila también en minúscula | - | 2 |
| #622 | `3270510c` | docs(auditorias): auditoría A3 — cierre de la ola 3 @ debf962f | - | 2 |
| #623 | `960c63aa` | docs(backlog): triage del barrido bl-q3 web y de la auditoría a3 | `BL-Q3` | 5 |
| #624 | `daa1ae81` | fix(chat): no filtrar el token HITL/desambiguación en la burbuja del usuario (BL-D4) | `BL-D4` | 16 |
| #625 | `107fdf61` | fix(web+mobile): BL-D6 tarjetas de Mi día en blanco + BL-D5 total aproximado + BL-D7 barra ‹900px | `BL-D5`, `BL-D6`, `BL-D7` | 11 |
| #626 | `a267be6c` | fix(motor): gate_card no se pierde en escrituras sin conexion ni en confirm-reentry | - | 7 |
| #627 | `f46ba0ae` | feat(onboarding): el onboarding es una conversación en el hilo, no una pantalla (BL-X8 resto) | `BL-X8` | 7 |
| #628 | `d2afdc9d` | fix(durabilidad): el instrumento de H-A3-8 confirmaba en vez de verificar | - | 3 |
| #629 | `6940a3fb` | docs(ADR-003): patched() se memoiza por run, no por turno (H-A3-3) | - | 3 |
| #630 | `8a7f2434` | fix(web+mobile): BL-W11 — fecha es-AR en Mi día, panel de agenda por conexión, aviso MP | `BL-W11` | 13 |
| #631 | `32e0dd2b` | feat(gate): GoTrue de test efimera wireada en cada corrida de backend (H-A3-11) | - | 3 |
| #632 | `047e0bf4` | fix(gate): el job backend no corre sin tríada propia ni sobre un stage ocupado | - | 5 |
| #633 | `aecd8187` | fix(web): BL-D8 — Conexiones renombrada a Apps, ícono Docs investigado | `BL-D8` | 15 |
| #634 | `498b96c7` | fix(gate): el recibo cubre por árbol y sobrevive al worktree que lo produjo | - | 3 |
| #635 | `4490c293` | fix(mobile+web): BL-X10 fila 2 — Reveal de primer ingreso | `BL-X10` | 17 |
| #636 | `3da0719d` | fix(gate): un recibo fallido no tapa al que cubre el mismo sha | - | 2 |
| #637 | `2f08bb28` | fix(web+mobile+core): BL-W12 — Ajustes web igual a mobile, fusión de la guía | `BL-W12` | 13 |
| #638 | `3c2297f1` | feat(chat): chip «Por voz · Ns» en la burbuja del usuario (BL-J7, web+mobile) | `BL-J7` | 15 |
| #639 | `b76cb47b` | fix(mobile): BL-Q4 fila 5 — contraste WCAG medido sobre el árbol renderizado | `BL-Q4` | 3 |

## 2. Esperado vs entregado, fila por fila

Sale del plan (`docs/copiloto-emprendedor/2026-09-21-plan-implementacion-beta-odobi-autonomo.md`, §8.1–8.3, columna **Ola = 4**) cruzado con los títulos de los PR de
arriba. Un **NO CITADO** no prueba que falte: prueba que el PR no la nombró, y eso es lo primero que
auditoría tiene que preguntar.

| Fila | Cola | ¿La cita algún PR? |
|---|---|---|
| `BL-B1` | BACKEND | ✅ sí (#603) |
| `BL-O3` | BACKEND | ❌ **NO CITADO** |
| `BL-Q2` | BACKEND | ❌ **NO CITADO** |
| `BL-Q3` | BACKEND + FRONTEND-1 + FRONTEND-2 | ⚠️ **citada, pero la mitad BACKEND + FRONTEND no tiene diff** (#623) |

**Filas de la Ola 4 sin PR que las cite, o con una mitad sin diff: 3.** Si es > 0, el pedido
a auditoría no sale hasta explicarlas una por una (entregada dentro de otro PR / diferida con dueño /
realmente abierta). «Mitad sin diff» se mide por las rutas que tocaron los PR, no por el título.

## 2.bis Entregadas en esta ventana pero asignadas a OTRA ola (adelantadas)

El plan las pone en otra ola, pero un PR de esta ventana ya las cita. **Entran en esta auditoría**:
si no se miden acá, nadie las mide (A1 §9.1: las J de la Ola 2 llegaron con los K de la Ola 0 y el
inventario no las listaba).

| Fila | Ola del plan | PR que la cita |
|---|---|---|
| `BL-B2` | 1 | #592 |
| `BL-B3` | 1 | #601 |
| `BL-B5` | 1 | #600 |
| `BL-B6` | 1 | #520 |
| `BL-B7` | 1 | #520 |
| `BL-C1` | 1 | #521 |
| `BL-C2` | 1 | #527 |
| `BL-C3` | 1 | #576,#526 |
| `BL-C4` | 1 | #521 |
| `BL-C6` | 1 | #574,#530 |
| `BL-D1` | 1 | #543 |
| `BL-D2` | 1 | #523 |
| `BL-D3` | 1 | #576,#523 |
| `BL-D4` | fuera del plan §8 | #624 |
| `BL-D5` | fuera del plan §8 | #625 |
| `BL-D6` | fuera del plan §8 | #625 |
| `BL-D7` | fuera del plan §8 | #625 |
| `BL-D8` | fuera del plan §8 | #633 |
| `BL-F1` | 2 | #562 |
| `BL-F2` | 1 | #535 |
| `BL-J10` | 2 | #545 |
| `BL-J11` | 2 | #610,#608,#606,#566,#554 |
| `BL-J12` | 2 | #609,#589 |
| `BL-J13` | 3 | #599,#596,#585 |
| `BL-J2` | 2 | #539 |
| `BL-J3` | 2 | #539 |
| `BL-J4` | 3 | #550 |
| `BL-J5` | 2 | #548 |
| `BL-J6` | 2 | #541 |
| `BL-J7` | 3 | #638,#620,#619,#615,#614,#609,#573 |
| `BL-J8` | 3 | #594 |
| `BL-J9` | 2 | #606,#602,#595,#588 |
| `BL-P5` | fuera del plan §8 | #611 |
| `BL-P8` | fuera del plan §8 | #519 |
| `BL-Q1` | 3 | #612 |
| `BL-Q4` | 2 | #639,#609,#582,#581 |
| `BL-V16` | fuera del plan §8 | #613 |
| `BL-V17` | fuera del plan §8 | #620,#613 |
| `BL-W1` | 1 | #529 |
| `BL-W10` | 1 | #553 |
| `BL-W11` | fuera del plan §8 | #630 |
| `BL-W12` | fuera del plan §8 | #637 |
| `BL-W2` | 1 | #521 |
| `BL-W3` | 1 | #551 |
| `BL-W4` | 1 | #532 |
| `BL-W5` | 1 | #524 |
| `BL-W6` | 1 | #556 |
| `BL-W7` | 1 | #524 |
| `BL-W8` | 1 | #524 |
| `BL-W9` | 1 | #537 |
| `BL-X1` | 2 | #533 |
| `BL-X10` | 3 | #635,#616 |
| `BL-X11` | 1 | #572,#528 |
| `BL-X12m` | 2 | #597,#531 |
| `BL-X12w` | 2 | #616,#531,#528 |
| `BL-X2` | 2 | #587 |
| `BL-X3` | 2 | #586 |
| `BL-X4` | 2 | #568 |
| `BL-X5` | 1 | #618,#580,#521 |
| `BL-X6` | 2 | #606,#578 |
| `BL-X7` | 2 | #560 |
| `BL-X8` | 3 | #627,#563 |
| `K-01` | fuera del plan §8 | #522 |
| `K-02` | fuera del plan §8 | #574,#538,#530 |
| `K-03` | fuera del plan §8 | #540,#539 |
| `K-04` | fuera del plan §8 | #542 |
| `K-05` | fuera del plan §8 | #546 |
| `K-06` | fuera del plan §8 | #547 |
| `K-07` | fuera del plan §8 | #607,#595,#588,#564 |
| `K-08` | fuera del plan §8 | #567 |
| `K-09` | fuera del plan §8 | #552,#550 |
| `K-10` | fuera del plan §8 | #620,#609,#573 |
| `K-11` | fuera del plan §8 | #594,#570 |
| `K-12` | fuera del plan §8 | #610,#608,#566,#561,#559,#554 |
| `K-13` | fuera del plan §8 | #591,#585 |
| `K-14` | fuera del plan §8 | #563,#558 |
| `K-15` | fuera del plan §8 | #560,#555 |

## 3. Controles de aislamiento nuevos — el test adversarial se CORRE, no se lee

Regla dura del repo (`CLAUDE.md` §Seguridad): un control de autorización sin test adversarial
ejecutado queda `[UNVERIFIED]` y bloquea el cierre.

⚠️ **Esta lista NO es la de adversariales** (A1 §9.4): son los tests que tocaron los PR de la ventana;
el resto del repo no entra. Cuáles ejercitan el caso hostil lo decide auditoría leyendo el test — un
filtro por nombre acá sería una allowlist que no sabe lo que le falta.

- `apps/copiloto-web/src/App.test.tsx` — #563, #616
- `apps/copiloto-web/src/arcaNoAfipVisible.test.ts` — #521
- `apps/copiloto-web/src/auth/EntradaSesion.test.tsx` — #616, #635
- `apps/copiloto-web/src/auth/LoginScreen.test.tsx` — #528
- `apps/copiloto-web/src/auth/SessionProvider.test.tsx` — #616
- `apps/copiloto-web/src/auth/useSession.test.ts` — #635
- `apps/copiloto-web/src/design-system/Marca.test.tsx` — #528
- `apps/copiloto-web/src/design-system/Recibo.test.tsx` — #562
- `apps/copiloto-web/src/design-system/ThemeProvider.test.tsx` — #568
- `apps/copiloto-web/src/design-system/fontsResuelven.test.ts` — #578
- `apps/copiloto-web/src/design-system/paresPintadosContraste.test.ts` — #581, #609, #616
- `apps/copiloto-web/src/design-system/themesContrast.test.ts` — #568
- `apps/copiloto-web/src/lib/api/reply.test.ts` — #526
- `apps/copiloto-web/src/modules/account/CambiarCredenciales.test.tsx` — #554, #566
- `apps/copiloto-web/src/modules/admin/AdminScreen.test.tsx` — #589, #609
- `apps/copiloto-web/src/modules/ajustes/LoPedisteVos.test.tsx` — #589, #609
- `apps/copiloto-web/src/modules/ajustes/PantallaApariencia.test.tsx` — #568
- `apps/copiloto-web/src/modules/ajustes/PantallaComoUsarLaApp.test.tsx` — #537, #637
- `apps/copiloto-web/src/modules/ajustes/PantallaFeedback.test.tsx` — #551, #589
- `apps/copiloto-web/src/modules/ajustes/afip/PantallaAfipSetup.test.tsx` — #574
- `apps/copiloto-web/src/modules/ajustes/negocio/PantallaPerfilNegocio.test.tsx` — #545, #560
- `apps/copiloto-web/src/modules/ajustes/negocio/PantallaTono.test.tsx` — #560
- `apps/copiloto-web/src/modules/chat/Bubble.test.tsx` — #638
- `apps/copiloto-web/src/modules/chat/ChatScreen.test.tsx` — #537
- `apps/copiloto-web/src/modules/chat/ChipArmarFactura.test.tsx` — #602
- `apps/copiloto-web/src/modules/chat/DisambiguationChips.test.tsx` — #624
- `apps/copiloto-web/src/modules/chat/HitlCard.test.tsx` — #528
- `apps/copiloto-web/src/modules/chat/MessageList.test.tsx` — #526, #624
- `apps/copiloto-web/src/modules/chat/MicButton.test.tsx` — #523, #529
- `apps/copiloto-web/src/modules/chat/RecordingOverlay.test.tsx` — #529
- `apps/copiloto-web/src/modules/chat/RodilloEjemplos.test.tsx` — #532
- `apps/copiloto-web/src/modules/chat/SheetRequiereConexion.test.tsx` — #594
- `apps/copiloto-web/src/modules/chat/TarjetaFacturaPropuesta.test.tsx` — #527, #562
- `apps/copiloto-web/src/modules/chat/TarjetaPresupuestoPropuesto.test.tsx` — #543
- `apps/copiloto-web/src/modules/chat/hitlMapping.test.ts` — #624
- `apps/copiloto-web/src/modules/chat/useChat.test.ts` — #624, #638
- `apps/copiloto-web/src/modules/chat/useConexionRequerida.test.tsx` — #594
- `apps/copiloto-web/src/modules/clientes/ClientesScreen.test.tsx` — #541, #614
- `apps/copiloto-web/src/modules/connections/ConnectionsScreen.test.tsx` — #521, #633
- `apps/copiloto-web/src/modules/connections/ServiceCard.test.tsx` — #521, #528, #550
- `apps/copiloto-web/src/modules/contabilidad/contabilidadNoHexLiterals.test.ts` — #587
- `apps/copiloto-web/src/modules/escritorio/seisFunciones.test.ts` — #587
- `apps/copiloto-web/src/modules/gastos/FormularioGasto.test.tsx` — #521
- `apps/copiloto-web/src/modules/gastos/GastosScreen.test.tsx` — #614, #619
- `apps/copiloto-web/src/modules/ingresos/IngresosScreen.test.tsx` — #614
- `apps/copiloto-web/src/modules/inteligencia/AcumuladoAnual.test.tsx` — #587
- `apps/copiloto-web/src/modules/inteligencia/InteligenciaScreen.test.tsx` — #556, #586, #587
- `apps/copiloto-web/src/modules/inteligencia/PreguntarInteligencia.test.tsx` — #586
- `apps/copiloto-web/src/modules/inteligencia/inteligenciaNoHexLiterals.test.ts` — #586
- `apps/copiloto-web/src/modules/midia/AgendaScreen.test.tsx` — #596
- `apps/copiloto-web/src/modules/midia/MidiaScreen.test.tsx` — #524, #539, #548, #550, #596, #630, #633
- `apps/copiloto-web/src/modules/midia/PortadaNegocio.test.tsx` — #539, #550
- `apps/copiloto-web/src/modules/midia/midiaTarjetaClamp.test.ts` — #625
- `apps/copiloto-web/src/modules/onboarding/Onboarding.test.tsx` — #563, #627
- `apps/copiloto-web/src/modules/presupuestos/DetallePresupuesto.test.tsx` — #588
- `apps/copiloto-web/src/modules/presupuestos/PresupuestosScreen.test.tsx` — #614
- `apps/copiloto-web/src/modules/soporte/SoporteScreen.test.tsx` — #553
- `apps/copiloto-web/src/modules/splash/EntradaDiaria.test.tsx` — #616
- `apps/copiloto-web/src/modules/splash/Splash.test.tsx` — #616, #635
- `apps/copiloto-web/src/modules/voz/MicFuncion.test.tsx` — #609
- `apps/copiloto-web/src/shell/AppShell.test.tsx` — #533, #537, #625
- `apps/copiloto-web/src/shell/AvatarCuenta.test.tsx` — #550
- `apps/copiloto-web/src/shell/DesktopShell.test.tsx` — #533
- `apps/copiloto-web/src/shell/Rail.test.tsx` — #587
- `apps/copiloto-web/src/shell/ResponsiveShell.test.tsx` — #533
- `apps/copiloto-web/src/shell/TabBar.test.tsx` — #587, #625
- `apps/copiloto/tests/test_admin_soporte.py` — #609
- `apps/copiloto/tests/test_adversarial_multitenant.py` — #558, #559, #567, #591, #607
- `apps/copiloto/tests/test_afip_cuit_vinculado_pg.py` — #538
- `apps/copiloto/tests/test_afip_onboarding.py` — #538
- `apps/copiloto/tests/test_arca_sin_afip_visible.py` — #580, #618
- `apps/copiloto/tests/test_cambiar_cuenta.py` — #559, #610
- `apps/copiloto/tests/test_cambiar_cuenta_gotrue_real.py` — #610
- `apps/copiloto/tests/test_catalog_route.py` — #552
- `apps/copiloto/tests/test_censo_except_guard.py` — #570
- `apps/copiloto/tests/test_cliente_store.py` — #542
- `apps/copiloto/tests/test_clientes_web.py` — #542
- `apps/copiloto/tests/test_composio_gateway_cache.py` — #628
- `apps/copiloto/tests/test_conexion_caida.py` — #552
- `apps/copiloto/tests/test_dispatcher.py` — #570, #607
- `apps/copiloto/tests/test_execute_tool.py` — #570, #591, #626
- `apps/copiloto/tests/test_factura_ventana_de_vida.py` — #592
- `apps/copiloto/tests/test_feedback_escuchado.py` — #567
- `apps/copiloto/tests/test_gastos_leer_foto.py` — #615
- `apps/copiloto/tests/test_instrumento_durabilidad_literal_sincronizado.py` — #629
- `apps/copiloto/tests/test_inteligencia_queries.py` — #540
- `apps/copiloto/tests/test_inteligencia_web.py` — #540, #552
- `apps/copiloto/tests/test_mi_dia_clasificacion.py` — #547, #552
- `apps/copiloto/tests/test_mi_dia_detector.py` — #552
- `apps/copiloto/tests/test_mi_dia_orquestador.py` — #552
- `apps/copiloto/tests/test_mi_dia_web.py` — #585
- `apps/copiloto/tests/test_mp_refresh_workflow.py` — #552
- `apps/copiloto/tests/test_perfil_negocio_ejemplo.py` — #555
- `apps/copiloto/tests/test_perfil_negocio_store.py` — #546
- `apps/copiloto/tests/test_plata_por_voz.py` — #564, #595, #607
- `apps/copiloto/tests/test_presupuesto_store.py` — #522
- `apps/copiloto/tests/test_presupuestos_web.py` — #522, #546, #555, #564
- `apps/copiloto/tests/test_transcribir.py` — #573
- `apps/copiloto/tests/test_web_app.py` — #558, #559
- `apps/copiloto/tests/test_workflow_replay_gate.py` — #592, #626
- `apps/mobile/src/modules/ajustes/CambiarCredenciales.test.tsx` — #554, #566
- `apps/mobile/src/modules/ajustes/PantallaComoUsarLaApp.test.tsx` — #637
- `apps/mobile/src/modules/ajustes/PantallaSkins.test.tsx` — #568
- `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.test.tsx` — #530, #533
- `apps/mobile/src/modules/ajustes/negocio/PantallaPerfilNegocio.test.tsx` — #545, #560
- `apps/mobile/src/modules/ajustes/negocio/PantallaTono.test.tsx` — #560
- `apps/mobile/src/modules/apps/PantallaApps.test.tsx` — #550
- `apps/mobile/src/modules/auth/EntradaSesion.test.tsx` — #597, #635
- `apps/mobile/src/modules/auth/PantallaLogin.test.tsx` — #597
- `apps/mobile/src/modules/auth/RevealEntrada.test.tsx` — #616
- `apps/mobile/src/modules/auth/session.test.tsx` — #635
- `apps/mobile/src/modules/chat/BotonVoz.test.tsx` — #523
- `apps/mobile/src/modules/chat/ChipArmarFactura.test.tsx` — #602
- `apps/mobile/src/modules/chat/IndicadorModoCeremonia.test.tsx` — #545
- `apps/mobile/src/modules/chat/ListaMensajes.test.tsx` — #523, #535, #576, #624, #638
- `apps/mobile/src/modules/chat/Recibo.test.tsx` — #562
- `apps/mobile/src/modules/chat/RodilloEjemplos.test.tsx` — #532
- `apps/mobile/src/modules/chat/SheetRequiereConexion.test.tsx` — #594
- `apps/mobile/src/modules/chat/TarjetaFacturaPropuesta.test.tsx` — #562
- `apps/mobile/src/modules/chat/TarjetaLinkDeCobro.test.tsx` — #535
- `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.test.tsx` — #543
- `apps/mobile/src/modules/chat/useChat.test.ts` — #624, #638
- `apps/mobile/src/modules/chat/useConexionRequerida.test.ts` — #594
- `apps/mobile/src/modules/clientes/PantallaClientes.test.tsx` — #541, #614
- `apps/mobile/src/modules/feedback/LoPedisteVos.test.tsx` — #589, #594, #609
- `apps/mobile/src/modules/feedback/PantallaFeedback.test.tsx` — #589
- `apps/mobile/src/modules/gastos/FormularioGasto.test.tsx` — #521
- `apps/mobile/src/modules/gastos/PantallaGastos.test.tsx` — #614, #619
- `apps/mobile/src/modules/ingresos/PantallaIngresos.test.tsx` — #614
- `apps/mobile/src/modules/inteligencia/ChatInteligencia.test.tsx` — #586
- `apps/mobile/src/modules/inteligencia/PantallaInteligencia.test.tsx` — #539, #550, #556, #586
- `apps/mobile/src/modules/inteligencia/PreguntarInteligencia.test.tsx` — #586
- `apps/mobile/src/modules/midia/PantallaAgenda.test.tsx` — #596
- `apps/mobile/src/modules/midia/PantallaMiDia.test.tsx` — #548, #596, #630, #633
- `apps/mobile/src/modules/midia/PortadaNegocio.test.tsx` — #539, #550
- `apps/mobile/src/modules/onboarding/PantallaOnboarding.test.tsx` — #563, #627
- `apps/mobile/src/modules/presupuestos/DetallePresupuesto.test.tsx` — #588
- `apps/mobile/src/modules/presupuestos/PantallaPresupuestos.test.tsx` — #588, #614
- `apps/mobile/src/modules/soporte/PantallaSoporte.test.tsx` — #553
- `apps/mobile/src/modules/splash/EntradaDiaria.test.tsx` — #616
- `apps/mobile/src/modules/splash/IdentidadEntrada.test.tsx` — #616, #635
- `apps/mobile/src/modules/voz/MicFuncion.test.tsx` — #609
- `apps/mobile/src/navegacion/Guard.test.tsx` — #627
- `apps/mobile/src/theme/EstadoVacio.test.tsx` — #524
- `apps/mobile/src/theme/movimientoReducido.test.tsx` — #523
- `apps/mobile/src/theme/paresPintadosContraste.test.tsx` — #639
- `apps/mobile/src/theme/temaContraste.test.ts` — #582, #609, #639
- `apps/mobile/src/theme/temaSinHex.test.ts` — #616
- `motor/backend/agent/test_gate_card_precedencia_bloquea.py` — #607
- `motor/backend/agent/test_gate_card_requiere_conexion.py` — #570
- `motor/backend/agent/test_gate_card_sobrevive_confirm.py` — #626
- `packages/core/src/api/afip.test.ts` — #530, #533
- `packages/core/src/api/agenda.test.ts` — #596
- `packages/core/src/api/auth.test.ts` — #554, #608
- `packages/core/src/api/capacidades.test.ts` — #637
- `packages/core/src/api/catalogo.test.ts` — #550, #630, #633
- `packages/core/src/api/clientes.test.ts` — #541
- `packages/core/src/api/ejemploDeTono.test.ts` — #560
- `packages/core/src/api/feedback.test.ts` — #589
- `packages/core/src/api/inteligencia.test.ts` — #539
- `packages/core/src/api/miDia.test.ts` — #548
- `packages/core/src/api/onboarding.test.ts` — #563
- `packages/core/src/api/perfilNegocio.test.ts` — #545
- `packages/core/src/api/presupuestos.test.ts` — #543, #588
- `packages/core/src/ayuda/temasAyuda.test.ts` — #537
- `packages/core/src/chat/gastoPropuesto.test.ts` — #619
- `packages/core/src/chat/linkDeCobro.test.ts` — #535
- `packages/core/src/chat/mensajePendiente.test.ts` — #537
- `packages/core/src/chat/requiereConexion.test.ts` — #594
- `packages/core/src/chat/separadoresFecha.test.ts` — #526
- `packages/core/src/chat/sugerenciaArmarFactura.test.ts` — #602
- `packages/core/src/dinero/totalAproximado.test.ts` — #625
- `packages/core/src/midia/caja.test.ts` — #539, #550, #630, #633
- `packages/core/src/midia/calma.test.ts` — #524
- `packages/core/src/midia/categoriaTarjeta.test.ts` — #524, #548
- `packages/core/src/midia/fechaMiDia.test.ts` — #630, #633
- `packages/core/src/midia/filtroTablero.test.ts` — #548
- `packages/core/src/refresco/textosRefresco.test.ts` — #556
- `packages/core/src/tema/preferenciaTema.test.ts` — #568
- `packages/core/src/textosEntrada.test.ts` — #597
- `scripts/ci/testid_paridad.py` — #612, #617

**Comando exacto para correrlos** (el job backend corre en el VPS; en segundo plano, salida completa
a archivo, sin sub-agentes vivos en la PC — bajo carga el gate falla por `fork`, A1 §4.3):

```bash
# El job va SOLO, sin guiones: `gate.sh --solo backend` no matchea ningún job, corre 0 y sale verde
# (A1 §4.1). La triada (DB/puerto/stage) sale de UC_SESION; si tu sesión no está en
# scripts/ci/sesion-env.sh, exportá UC_TESTDB_NAME/UC_TESTDB_PORT/UC_TEST_STAGE propios.
UC_SESION=<tu-sesión> bash scripts/gate.sh backend > "gate-backend-$(date +%s).log" 2>&1
# Anti falso verde del JOB: la línea de resumen «N passed» contra el piso, y "jobs" no vacío en el
# recibo. NO cuentes `PASSED`: el job corre `--co -q` + `-q` y nunca imprime PASSED por test (da 0
# también con la suite sana — pedido de auditoría A2, 21/09).
grep -Eo '[0-9]+ passed' gate-backend-*.log | tail -1   # piso vigente: 2045 (6b410923)
# Resultado de UN test puntual (un adversarial): -rA imprime una línea PASSED/FAILED por test.
bash deploy/copiloto/sync-test-backend.sh tests ../../motor/backend/agent ../../motor/clients/agent -q -rA > rA.log 2>&1
grep -E '^(PASSED|FAILED|ERROR).*<nombre_del_test>' rA.log
```

## 4. Evidencia de device

`[PENDIENTE_DEVICE]` no es un estado de excepción: es el estado por defecto de toda fila táctil
hasta que el móvil esté libre. Auditoría marca como **no cerrable** cualquier fila que dependa de
device y no traiga su evidencia, sin importar que el PR esté mergeado.

## 5. Qué NO entra en esta auditoría

Lo que el plan asigna a olas posteriores, y todo lo que no aparezca en §1. Cada hallazgo se devuelve
como **fila para que planificación la asigne** — auditoría no abre trabajo propio (plan §9).

---

## Anotaciones de planificación (a mano, sobre el generado)

- **SHA final de la beta: `b76cb47b` (#639).** `recibo-cubre.sh b76cb47b` → ✅: su árbol (`b04ef3a4`) es idéntico al de la cabeza `b90f7549`, con recibo fe1 5/5 y sin `sucio` (2026-09-22T10:35:14Z).
- **Cobertura transitiva:** `3c2297f1` (#638, BL-J7) no tiene recibo propio. `b76cb47b` lo contiene (`git merge-base --is-ancestor`) y está cubierto, así que el árbol que incluye J7 lo probó el gate de Q4.
- **Prod corre el SHA final:** backend/motor/deploy sin cambios entre `32e0dd2b` (último deploy) y `b76cb47b`. El bundle web de prod (`index-DFOGJ5Ax.js`, 10:37 UTC) trae `chat-bubble-voz` de J7, y #639 es sólo mobile.
- **Diferidos:** no son hallazgos. Están declarados con su dueño en el contrato A4 §0.2: device, EAS #2, BL-Q3 device, la mitad mobile de la matriz, H-A3-9, BL-O9, BL-O3 y BL-C5 van al sprint siguiente, y BL-O4, BL-X6/DEC-5, el audio «o-DO-bi» y los 34+1 pares de BL-Q4 quedan para decisión del operador.
