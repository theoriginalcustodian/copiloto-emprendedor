# CHECKPOINT — cierre del sprint (para retomar tras compactar) · 2026-07-23 ~11:50

> Escrito por PLANIFICACIÓN antes de una compactación. Estado vivo del cierre E2E que estoy
> conduciendo. Al retomar: leer esto + `coordinacion/abierto/` (hilo de hoy) + la todo-list.

## 0. Qué estoy haciendo
Conduciendo el **cierre E2E del sprint** (IN + mobile-first) bajo el mecanismo **§6 recién establecido**
(`COORDINACION.md §6` + `memoria/una-orden-cerrada-exige-evidencia-de-device.md`): una orden está
TERMINADA solo con evidencia de **device**; "mergeado a main" ≠ terminado. **Nunca reportar terminado
desde git/buzón.** Perilla §6.6 decidida por el operador: backend prueba en tenant de prueba con
evidencia + el teléfono del operador se pone al día en el mismo cierre.

## 1. 🔴 BLOQUEADOR ACTUAL — el dev-client no conecta (bug upstream de Expo)
- **Raíz confirmada (V-EXT contra changelog de `expo-dev-launcher`):** el ANR es un **bug upstream,
  conocido, SIN publicar** (la feature "Development Servers" ligada a cuenta EAS). El auto-launch
  también está roto (confirmado en device 11:49). Bumpear la dep NO sirve (fixes en `Unpublished`).
- **Efecto:** el teléfono del OPERADOR quedó trabado en la pantalla del dev-launcher (matamos el Metro
  viejo al apuntar a main y el dev-client no reconecta). Su código NO está roto — es la herramienta.

## 2. 🔴 RE-PRIORIDAD (directiva del operador) — dev-client VIVO primero, build ÚLTIMO
El dev-client es para **iterar sin recompilar**; un build de 15 min por fix es inviable. Orden:
**(1) restaurar live-reload → (2) verificar/iterar → (3) build UNA vez al final.**
Bypass a probar, en orden (sin rebuild), `dato_..._RE-PRIORIDAD-dev-client-vivo-PRIMERO`:
1. 🎯 **Modo avión + `adb reverse tcp:8081` (USB) + deep-link** — el fetch de cuenta falla rápido (sin
   internet) en vez de colgar; el Metro en localhost sigue por el cable. (Sale del propio dato de
   backend: "en avión NO hay ANR".) **← la que hay que probar YA.**
2. **Deep-link con el scheme EXACTO de `app.json`** — frontend lo está verificando contra docs (11:49).
3. **Login a `341lin` en el dev-client** (el operador, en su teléfono).
4. **Último recurso (MAYOR, UNA vez):** rebuild de un **dev-client** con `expo-dev-launcher` pinneado a
   una versión previa al discovery-por-cuenta → live-reload para siempre.
- **EAS preview build EN VUELO** (cuenta `341lin` ya autenticada en la máquina de frontend): instalar
  SOLO para **destrabar el teléfono + que el operador vea main**. NO es el vehículo de debug. No
  rebuildeár por cada fix.

## 3. Backend listo
`avance_..._harness-E2E-listo-para-frio-cero` (11:46): el harness del E2E acumulativo está armado
(recorrido IN/voz/freeze + backlog, tenant de prueba, secuencias adb, estado esperado). En cuanto haya
live-reload, el E2E arranca sin demora.

## 4. Backlog del cierre (ledger completo: `scratchpad/close-out-ledger.md`)
- **(A) Mergeado, solo espera device E2E** → lo cierra la corrida acumulativa: voz, freeze, gastos,
  ingresos/cobros, clientes, presupuestos, actividad reciente.
- **(B) Implementación real pendiente:**
  - **IN wiring** = **PR#78 ABIERTO** (gráficos+chat en `/inteligencia`; tsc+tests verdes; NO mergeado
    sin device, §6). *"IN vacío" era en parte esto, no solo el device viejo.*
  - **narra-sin-hacer** (el copiloto dice "ya lo hice" sin llamar la tool): **de-risk VERDE**
    (replay-verify OK) → **ESPERA EL VISTO DEL OPERADOR a v1** → luego fix del motor. **Bloquea hitos
    7/8/9.** Contrato `..._narra-sin-hacer-el-bloqueador-de-tres-hitos`.
  - **Hitos 7 (Mi día+detector) / 8 (modos) / 9 (facturar por voz)** — bloqueados por narra-sin-hacer.
- **(C) Contabilidad (hito 4):** placeholder deliberado; se destraba emitiendo `listo_clientes-cerrado`
  (nunca se emitió) cuando clientes pase su compuerta de device.

## 5. ⏳ Decisiones del operador PENDIENTES
1. **Visto a v1 de narra-sin-hacer** (de-risk ya verde) → desbloquea 7/8/9.
2. **Opcional:** loguearse a `341lin` en el dev-client del teléfono (test barato del ANR).
3. **MAYOR latente:** retirar la rama muerta `feat/mobile-first-cascara-glass` (main es el tronco:
   0 adelante, 47 atrás) — pendiente de confirmar.

## 6. Infra de sesión
- **3 crones de PLANIFICACIÓN vivos** (sobreviven compactación): PARÁLISIS `cbc18a2f` (*/3), vigía v3
  `bfce85a0` (7,27,47), ociosas `e9ab81d2` (1-58/3). Textos canónicos en `coordinacion/CRONES.md` +
  `.claude/commands/monitoreo.md`.
- **Git:** `origin/main` @ `5e09690` = tronco real. Rama `feat/mobile-first` congelada (13h).
- **Buzón:** `abierto/` 65, `en-curso/` 35 (barrí ~41 broadcasts consumidos hoy). El hilo activo del
  cierre son los `dato_`/`avance_` de `2026-07-23` en `abierto/`.
- **PRs abiertos:** #78 (IN wiring, gated a device).

## 7. Al retomar (primer paso)
Medir el buzón (`find coordinacion/... -mmin`) por el resultado del **bypass del dev-client** (¿conectó
avión+USB+deep-link?) y por el **APK de EAS** (¿link publicado?). Si hay live-reload → backend corre el
E2E con su harness. Si el APK cayó → instalar para destrabar el teléfono. Seguir el orden §2.
