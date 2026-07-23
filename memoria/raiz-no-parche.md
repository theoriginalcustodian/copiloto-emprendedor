---
name: ""
metadata: 
  node_type: memory
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

**"Resolver de raíz, no parchear"** es regla de oro #2 + 6 verificaciones #5 ("RAÍZ, NO PARCHE — ¿causa raíz o tapando un síntoma? 5 whys, fishbone") + criterio duro #2 ("Definitiva ≠ parche") del CLAUDE.md global. Cubre el **eje del DIAGNÓSTICO** del ciclo de desarrollo — el momento entre "algo falla" y "lo arreglo". Es parte de la visión del operador (2026-06-21) de **cubrir todo el ciclo** con las reglas de desarrollo, cada una con activación determinística.

**Why:** un parche tapa el síntoma → el fallo **vuelve** (fix-del-fix), y apilar parches no converge sin volver a la causa. Es deuda con interés compuesto (conecta con [[cero-deuda-no-gestionada]]: un parche consciente = workaround = deuda gestionable). La causa raíz se encuentra con 5 whys / fishbone (preguntar *por qué* falla, no solo *qué* falla).

**El gap que ningún otro hook cubría (y el diseño quirúrgico):** "raíz no parche" se solapa con dos hooks existentes — `tech_debt` (parche consciente = deuda, ya cubierto) y `empirical_check` (dispara en el primer "arreglá"). El gap PURO es el parche **inconsciente** (atacar el síntoma sin diagnosticar, creyendo que se resolvió), y su **huella empírica nítida** es el **fix-del-fix / fallo persistente** ("sigue fallando", "otra vez", "no funcionó el arreglo", "van N intentos") = el **tactical drift** del global, que no tenía hook. Por eso el hook `root_cause_suggester` se acotó a esa señal: dispara raro, alto valor, **cero solapamiento** (no triplica alertas en el momento del fix). El primer fix se cubre con una línea extra en el bloque de `empirical_check` ("atacá la causa raíz, no el síntoma").

**How to apply:** ante un fallo que persiste o un 2º+ fix sobre la misma entidad → **PAUSÁ antes del próximo intento**: ¿causa raíz o síntoma? 5 whys / fishbone hasta la causa; re-aplicá el **Paso 4.5** (`framework-self-check`); NO parchees el parche. Un parche consciente es legítimo solo como deuda registrada (TODO de raíz + propietario + fecha). Excepciones (no es drift): el 2º fix es ortogonal al 1º · es revert · ya identificaste la causa y este es el fix definitivo.

**Reflejado (2026-06-21):** receta completa — doctrina ya estaba exhaustiva (regla de oro #2 · 6 verif #5 · criterio duro #2 · tactical drift) → **memoria** (este fact) + **hook `root_cause_suggester`** (6 triggers, smoke 5/5, quirúrgico al fix-del-fix) + **línea en `empirical_check`** para el primer fix. Detalle en `HARNESS.md` §1.2 (#10)/§8. Requiere restart. Relacionado: [[no-codificar-la-esperanza-principio-raiz]] (el tronco), [[cero-deuda-no-gestionada]] (parche = deuda), [[spike-first-central-proyecto]].
