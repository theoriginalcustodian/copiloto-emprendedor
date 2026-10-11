---
name: no-era-que-no-cazaba-el-patron-era-que-no-lo-cazaba-en-su-forma-real
description: Un escáner puede cazar el secreto SUELTO y escaparlo con su prefijo real. Todo resultado negativo sobre un patrón exige el fixture en la FORMA en que el patrón aparece de verdad.
metadata:
  type: feedback
---

**«El escáner no caza X» casi nunca es el hallazgo. El hallazgo es «no caza X en la FORMA en que X
aparece de verdad».**

**Medido el 2026-10-06** sobre gitleaks en este repo. El mismo valor de alta entropía, suelto, **sí**
lo caza la regla `generic-api-key`. Con su **prefijo real** (`sk-ant-api03-…`) **se escapa**: los
guiones del prefijo y los `:/@` de un DSN **cortan la coincidencia contigua de alta entropía**. O sea
que un fixture "equivalente" daba verde y el secreto real pasaba.

🔑 **Y el segundo hallazgo, que invalidó mi primer par de contraste:** `generic-api-key` **no es sólo
entropía: está puerteada por PALABRA CLAVE.** `CLAVE_SUELTA=<95 chars de alta entropía>` → **0
hallazgos**. `ANTHROPIC_API_KEY=<el mismo valor>` → **cazado**. Mi par movía el prefijo **y** el
nombre de la variable al mismo tiempo, así que era **ininterpretable**: no podía saber cuál de los
dos cambios producía la diferencia. Mismo error metodológico que el hallazgo denuncia, un nivel
arriba.

**Cómo aplicarlo**
- Un par de contraste mueve **UNA** variable. Si moviste dos, el resultado no atribuye nada: no es
  evidencia débil, es **cero** evidencia. → [[dos-causas-suficientes-el-test-no-atribuye]]
- El fixture de un escáner se escribe con la **forma de producción** del secreto: prefijo real,
  nombre de variable real, envoltorio real (DSN, header, `export`). Un valor "equivalente" mide
  otra cosa.
- Y el fixture **no puede contener el patrón contiguo** en el fuente commiteado, o el escáner caza
  su propio test: partir el literal (`'sk-ant-''api03-%s'` vía `printf`).
- Aseverá el **`RuleID`**, no `rc=1`: con `rc`, una regla por defecto que dispare sobre el mismo
  fixture deja el test verde **con tus reglas ausentes** — falso verde en el test que acredita el fix.
- Antes de embarcar una regla nueva, **medí el blast radius**: la mía dio **9 falsos positivos** (se
  bajó a 0 en dos pasos, midiendo el efecto: 9 → 5 → 0). Un guard que grita en el caso normal se
  desarma solo, y el camino de menor resistencia es `--no-verify`, que apaga el gate entero.
  → [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]
- Y un allowlist contra `match` **no puede ver más allá del match**: mi regex terminaba en `@`, así
  que `@(localhost|127\.0\.0\.1)` no podía disparar nunca. `regexTarget = "line"` lo arregló.
  → [[instrumento-que-no-mira-nunca-falla]]

---

## ⚠️ REFUERZO 2026-10-11 — el falso 0 tenía la cara EXACTA del hallazgo que el instrumento buscaba

No es sólo cosa de escáneres de secretos. **Medido hoy** sobre el relevamiento mobile: escribí un
instrumento que, por cada ruta de Expo, busca quién la navega, para detectar la clase 🕳️ *«capacidad
completa que nadie alcanza»*. Mi patrón exigía la comilla de cierre **pegada** al literal de la ruta:
`['"`]/legal['"`]`. Reportó que `/legal` era la **única** pantalla con **cero** call-sites.

**Era falso.** El call-site real es `router.push('/legal?kind=tos')` — `PantallaCuenta.tsx:61` y `:66`.
La ruta estaba citada, pero con **query string**: la comilla no venía pegada. El patrón cazaba la
ruta, no su forma real. Corregido (`(?:[?#][^'"`]*)?` antes del cierre), `/legal` da **2**.

🔑 **Lo que lo hace peor que un bug cualquiera: el error se disfrazaba de resultado.** El instrumento
existía para encontrar pantallas inalcanzables, y su defecto **fabricó una**. Un falso cero no se
siente como una falla: se siente como el hallazgo que fuiste a buscar, con su sección en el documento
ya escrita. → [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

**Y el mismo instrumento, en la misma corrida, falló en el sentido opuesto:** para la raíz `/`, el
literal `['"`]/['"`]` matcheaba cualquier `"/"` del código y daba **136** call-sites. Un cero
inventado y un número inflado, en el mismo script, el mismo día. No era mala suerte: el patrón
genérico es laxo en el caso degenerado y estricto en el caso con parámetros, y ninguno de los dos
extremos avisa.

**Cómo aplicarlo:** un instrumento que busca **ausencias** lleva control positivo **antes** de
publicar un solo cero — una lista de casos que se sabe presentes, verificados a mano con grep, que
él **debe** encontrar. Si alguno da 0, aborta y no publica la columna. Y la lista tiene que incluir
el caso **con la decoración real** (el `?query`, el prefijo, el envoltorio), no sólo el caso limpio;
más un **techo** para el caso degenerado, que es donde sobre-matchea.
→ [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]
→ [[un-control-positivo-con-esperado-falso-acusa-al-script]]
