# M-3 / H-A4-1 — Test adversarial de la capa LOCAL de secretos (`pre-push` → gitleaks)

**Fecha:** 2026-09-22 · **Sesión:** AUDITORÍA · **Disparador:** verde explícito de planificación para M-3.

> **Qué NO cierra este documento.** H-A4-1 pregunta por **push protection del servidor**. Acá se midió
> la capa **local**, contra un remoto bare en disco: **nada se publicó, GitHub no se tocó**.
> La capa server-side quedó medida **por configuración** (ver §«La capa server-side, medida por
> configuración») pero **no ejercitada**, y su caso non-provider *publicaría por diseño* en un repo
> público — por eso este informe **recomienda no correrlo acá** y cerrar el gap en su lugar.

---

## Veredicto

**La capa local frena secretos, incluidos los genéricos — y sólo existe en árboles posteriores a #601.**
Los cuatro casos coincidieron con la predicción escrita antes de correr.

| | caso | esperado | observado | qué capa lo rechazó |
|---|---|---|---|---|
| ✅ | A · proveedor, árbol al día | ABORTA | **ABORTA** | scanner (4 commits escaneados, `leaks found: 5`) |
| ✅ | B · non-provider, árbol al día | ABORTA | **ABORTA** | scanner (5 commits escaneados, `leaks found: 7`) |
| ✅ | C · proveedor, árbol base vieja | PASA | **PASA** | ninguna — el hook corrió y no tiene scanner |
| ✅ | D · inocuo, escáner inutilizable | ABORTA | **ABORTA** | scanner caído (fail-closed) |

El veredicto de cada fila sale de si la ref **llegó al bare** (`git show-ref`), no del exit code de
`git push` — un push puede salir distinto de 0 y haber escrito igual.

### Sujeto

| qué | SHA |
|---|---|
| `origin/main` remoto (abrir y cerrar, sin cambios durante la corrida) | `88ddaad38c50fb0b574d5a840f73376d66914a42` |
| árbol AL DÍA ejercitado (= marcador del grafo) | `1542e3ad94ef8469243ff968f1a7782bbaa80bb2` |
| el scanner nace en (#601) | `245fc3f272bde2e8c307325703a1024c0b64fa18` |
| árbol BASE VIEJA ejercitado (padre de #601) | `6b410923d09658349fcffd10d13ee21e1e395a4c` |

`origin/main` se movió **cuatro veces** durante la jornada (FE1 mergeó #664 y #663). No afecta este
resultado: se ejercitan **hooks de árboles fijados por SHA**, no el estado de `main`.

---

## Por qué hacen falta cuatro casos y no uno

Un solo push no atribuye. Un «pasó» puede ser el control roto, el cebo no reconocido o un hook que ni
llama al escáner; un «abortó» puede venir de otra cosa. Concretamente, el `pre-push` tiene **dos
causas suficientes de aborto**: el escáner (líneas 15-16) y `graph-sync`, también fail-closed.

Un aborto del segundo no diría nada sobre secretos —y además **mutaría el grafo**, estado compartido
del que esta sesión no es dueña. El hook trae su propio atajo: si `origin/main` coincide con el
marcador del bridge, sale `exit 0` sin sincronizar. Por eso el `origin` de los clones de prueba es un
**bare fijado en el SHA del marcador**: el hook corre **intacto, byte por byte**, el escáner se
ejercita de verdad y `graph-sync` nunca llega. Verificado en el log de C:
`[pre-push] (grafo ya sincronizado … nada que hacer)`.

### Control del material, antes de todo

`secretos-check.sh --arbol` sobre el cebo de proveedor → **rc=1: lo detecta**. Sin este control, un
«pasó» sería el cero de un detector ciego, no evidencia.

### Control aislado del caso B (y por qué hizo falta)

B escaneó 5 commits, y entre ellos estaba el del caso A con el cebo AWS: los 7 hallazgos podían venir
de ahí, con lo cual B **no** probaría cobertura de lo genérico. Se midió aparte, con el mismo `.gitleaks.toml`:

- material **non-provider solo** → `leaks found: 2`, rc=1 ✅
- control negativo (archivo inocuo) → rc=0 ✅ (no marca cualquier cosa)

**Conclusión:** gitleaks con la config del repo **sí** cubre secretos propios (`DB_PASSWORD`,
`UC_INTERNAL_TOKEN`, cadena de conexión) — exactamente la clase que GitHub **no** intercepta, porque
`secret_scanning_non_provider_patterns` está **disabled**.

---

## Hallazgos

### H1 · Un árbol viejo no tiene capa local, y el checkout compartido es uno — SEVERIDAD ALTA

El caso C no es teórico. Medido hoy: el `.githooks/pre-push` del **checkout compartido** tiene **cero**
líneas `secretos-check` (control positivo: shebang = 1, el grep sí miraba), mientras el de `origin/main`
lo invoca en la línea 15. El checkout está ~141 commits atrás y **nunca corrió gitleaks** — no tiene
siquiera el directorio `.tools/`.

Quien pushee desde ahí **no tiene capa local**, y la del servidor no cubre patrones non-provider. Las
dos capas fallan sobre la misma clase de secreto, que es la que este repo realmente usa.

**Cuantificado sobre los árboles vivos** (26 en `git worktree list`), midiendo por dos vías
independientes —ancestría respecto de #601, y contenido del `.githooks/pre-push` con control positivo
de shebang para distinguir «no menciona» de «no leí»—:

| | árboles | cuáles |
|---|---|---|
| con capa local | 22 | el resto |
| **sin capa local** | **4** | `copiloto-emprendedor` (**el checkout compartido**), `b6-ctl-fe1`, `agent-ae509f91fdb378fff` (sin `secretos-check`) y `_documed-wt` (**sin hook alguno**) |

**Cero discrepancias entre las dos vías**: la ancestría predice exactamente la presencia del escáner.
Eso es útil para el fix del gate — un chequeo por ancestría respecto de #601 sería suficiente, y hoy
no cuesta más que el que compara la ruta de `core.hooksPath`.

El peor de los cuatro es el checkout compartido: es el directorio por defecto de las tres sesiones.

> Planificación tomó de acá un hueco adicional del gate: el check que #649 puso en `gate.sh` compara
> **`core.hooksPath == .githooks`**, o sea verifica *a dónde apunta*, no *qué contiene*. Un árbol viejo
> con la ruta correcta pasa el check con un hook sin escáner. Encolado del lado de instrumentos.

### H2 · Un escáner que no arranca se anuncia como «encontró secretos» — SEVERIDAD MEDIA

Medido con control positivo: gitleaks devuelve **rc=1 tanto si encontró algo como si no pudo cargar su
config**; con config buena sobre árbol limpio devuelve 0. `secretos-check.sh` mapea todo rc=1 a
«gitleaks encontró posibles secretos».

Es fail-closed —el push aborta, no hay fuga— pero **diagnostica mal**: manda a buscar un secreto que no
existe y empuja al bypass documentado (`--no-verify`), que apaga **todo** el hook, incluido el escáner
que sí funciona.

**Fix de raíz sugerido** (una línea, del lado de instrumentos): validar la precondición antes de
invocar (`[ -f "$ROOT/.gitleaks.toml" ] || fatal "config ausente"`) y/o distinguir por la salida
(`FTL` / `unable to load`) antes de anunciar un hallazgo.

Esto no es hipotético: **invalidó dos filas de este mismo test** en su primera corrida. Ver H4.

### H3 · Un clon nuevo no puede pushear: el binario no está y la descarga falla — SEVERIDAD MEDIA

gitleaks se cachea en `$ROOT/.tools/`, **dentro de cada checkout**. En un clon nuevo no está, y bajarlo
falló con `curl (23)` — error de **escritura**, con 112 GB libres, así que no es disco. Candidato **no
medido**: el antivirus interceptando un `.exe` de escaneo de secretos. Consecuencia: `rc=2` ⇒ **todo**
push desde ese clon aborta. Fail-closed correcto, pero es un guard que grita en el caso normal, y esos
se desarman solos.

### H4 · Nota sobre este mismo instrumento (se corrigió y se re-corrió)

La primera corrida dio A y B en «ABORTA · scanner:hallazgo» y era **falso**: el script exportaba
`MSYS_NO_PATHCONV=1` (puesto para que `git show '<sha>:<path>'` no manglara paths), **el hook la
heredaba**, y gitleaks —binario Windows nativo— recibía `$ROOT` en formato MSYS y no podía cargar
`.gitleaks.toml`. Por H2, eso se anunció como hallazgo. Los dos casos abortaron **sin escanear nada**.

Corregido: la variable va inline sólo en el comando que la necesita, y el push usa el nombre de rama en
vez de una refspec con `:`. Se agregó una regla de atribución que lee `FTL`/`unable to load` y pisa la
de «hallazgo». Las cifras de la tabla son de la corrida corregida, con `FTL = 0` verificado en ambos logs.

**La lección, que vale más que el bug:** la atribución de un test no puede salir del mensaje del sujeto
que está midiendo.

---

## Reproducir

`scripts/` no versiona este test (es de auditoría, no del gate). El script vive en el scratchpad de la
sesión y es idempotente, con `--limpiar`:

- arma un bare local + dos clones (no worktrees: no ensucian `git worktree list`)
- **material sintético y aleatorio**, generado en la corrida — ninguna credencial viva ni de las que
  pasaron por chat
- aborta con `exit 2` si el control del material falla, sin concluir nada

---

## La capa server-side, medida por configuración (2026-09-22, posterior a la corrida)

Antes de pedir la decisión sobre el push, se consultó la configuración real del repo por API —
**read-only, sin publicar nada**:

| clave | valor |
|---|---|
| `visibility` | **public** |
| `secret_scanning` | enabled |
| `secret_scanning_push_protection` | **enabled** |
| `secret_scanning_non_provider_patterns` | **disabled** ← el gap |
| `secret_scanning_validity_checks` | disabled |

Control positivo: la API respondió `full_name = theoriginalcustodian/copiloto-emprendedor`, o sea
sobre este repo y no sobre otro.

Hasta acá `non_provider_patterns: disabled` se venía **citando**; ahora está **medido**. Sostiene la
predicción escrita: un push con `DB_PASSWORD`, `UC_INTERNAL_TOKEN` o una cadena de conexión **pasa**,
porque push protection sólo intercepta patrones de proveedor. Y confirma H1 por el otro lado: las dos
capas —la local, ausente en 4 de 26 árboles, y la del servidor, ciega a lo genérico— fallan sobre
**la misma clase de secreto**, que es la que este repo realmente usa.

## Qué falta para cerrar H-A4-1, y por qué se recomienda NO correrlo acá

Faltaría un push **real a GitHub** con material non-provider. Predicción escrita: **pasa**. Ese push
**publica el cebo en un repo público** — resultado esperado, no accidente.

**Recomendación de esta auditoría: no correrlo en este repo.** El test demostraría empíricamente algo
que la configuración ya **declara y que acaba de medirse**; su valor marginal es verificar que GitHub
se comporta como su propia config dice. Contra eso, dos costos que sólo se ven al diseñar el control:

1. **Borrar la rama no borra el objeto**, y con `secret_scanning: enabled` el repo se escanea de forma
   continua, no sólo en el push: el cebo queda alcanzable por SHA y visible para cualquier fork o mirror.
2. **El control positivo es peor que el caso real.** Para que la fila valga hay que pushear también un
   cebo **de proveedor**, que GitHub *sí* debe rechazar. Si ese bloqueo fallara, se publica algo con
   forma de credencial de proveedor — justo el patrón que dispara alertas automáticas hacia terceros.
   Un control cuyo modo de falla es más grave que lo que mide no es un buen control.

**Alternativa propuesta: cerrar el gap en vez de demostrarlo.**
`secret_scanning_non_provider_patterns` es un toggle de la misma API con la que se hizo esta medición.
Activarlo elimina el gap, se verifica por el mismo instrumento sin publicar nada, y deja el ejercicio
adversarial —si se lo sigue queriendo— para un **repo privado desechable**, donde el cebo no le importa
a nadie y el control positivo de proveedor no tiene filo.

Así el disparador pendiente deja de ser «¿autorizás publicar un secreto?» y pasa a ser
**«¿activamos non-provider patterns?»**: la misma pregunta de fondo, sin costo irreversible.
**Es una decisión MAYOR sobre la configuración de seguridad de un repo público, así que la toma el
operador; esta auditoría no la ejecuta.**
