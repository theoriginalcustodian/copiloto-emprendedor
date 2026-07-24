---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# «Preguntá al grafo primero» es regla escrita, y las reglas escritas se evaporan en la hora 6

**Evidencia:** el canon lo exige (regla 2, inyectada en cada turno) y aun así el sprint gastó
**3,84 M tokens de salida con 42 % de actos productivos** — el resto, lecturas y exploración.
`[HIPÓTESIS]` sobre la porción exacta atribuible a barridos que el grafo hubiera respondido: no está
medida. La mediría el histograma de comandos repetidos de `scripts/metricas-sesiones.py`.

**Qué falló:** nivel 2 puro. Una regla contextual protege del **olvido**, no de la **racionalización**
—«esto es rápido, lo grepeo»— y su costo se paga en cada turno de cada sesión, para siempre.

**Gancho a construir:** `PreToolUse` que intercepte el barrido a ciegas (grep/glob de alcance amplio
sin ruta acotada) y devuelva la consulta al grafo equivalente. **No bloquear**: sugerir con la consulta
ya armada, y bloquear sólo a partir de la segunda repetición del mismo barrido en la sesión.

**DoD binario:**
- Un `grep` amplio sin ruta acotada → el hook responde con la consulta al grafo lista para copiar.
- Segundo barrido idéntico en la misma sesión → bloqueado.
- **Control negativo:** un `grep` acotado a un archivo o a un directorio chico → el hook **no** dice
  nada. Si también interrumpe ahí, es ruido y se va a desactivar entero.

---

## ❌ DESCARTADO — 2026-07-24, con la razón y la condición para reabrirlo

**No se construye.** La decisión es explícita, no un olvido: por eso el archivo se mueve a
`descartados/` en vez de quedarse en la cola bloqueando el reparto (§7 del bucle).

**Por qué:**

1. **Sería el hook 33 sobre 32.** Los hooks ya inyectan 500-800 tokens en un turno típico, con picos
   de 2.500, y el peaje es **recurrente**: se paga en cada turno de cada sesión, para siempre. El
   propio bucle fija el presupuesto del nivel 2 (§11): *cuando algo entra, algo debería salir*. Acá no
   sale nada.
2. **Su evidencia es la más débil de la cola.** El auditor la marcó `[HIPÓTESIS]` él mismo: la porción
   de gasto atribuible a barridos que el grafo habría respondido **no está medida**. Los otros cuatro
   pendientes traían números duros; éste, una intuición razonable.
3. **La regla ya existe en nivel 2** (canon 2 y 3, inyectados cada turno). El gancho sería subirla a
   nivel 1 sin haber probado que el nivel 2 falla lo suficiente como para justificar el costo.

**Condición para reabrirlo — concreta, no "si hace falta":**

> Correr `scripts/metricas-sesiones.py` sobre un sprint completo y clasificar el histograma de
> comandos repetidos: **si más del ~15 % de los barridos amplios (grep/glob sin ruta acotada) son
> consultas que el grafo habría respondido**, el gancho se justifica y vuelve a `pendientes/`.

Hasta tener ese número, construirlo sería codificar la esperanza — con un costo recurrente y una
hipótesis sin medir, que es la combinación exacta que este bucle existe para evitar.
