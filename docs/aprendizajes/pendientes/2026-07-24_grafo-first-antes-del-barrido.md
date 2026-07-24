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
