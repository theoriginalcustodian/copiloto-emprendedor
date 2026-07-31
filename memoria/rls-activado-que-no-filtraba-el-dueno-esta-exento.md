---
name: rls-activado-que-no-filtraba-el-dueno-esta-exento
description: RLS activado en 77 tablas y filtrando en ninguna — Postgres exime al DUEÑO de sus propias policies salvo FORCE
metadata:
  type: project
---

**`ENABLE ROW LEVEL SECURITY` no alcanza: si la app se conecta con el rol DUEÑO de la tabla, Postgres
la exime de sus propias policies salvo que se declare `FORCE ROW LEVEL SECURITY`.** El RLS queda
activado en el catálogo y **no filtra nada**, sin ningún síntoma.

**Medido (2026-07-31, producción).** Una consulta sin ningún JWT, con las credenciales de la app:

```
copiloto_gastos        filas=8   tenants_visibles=3
copiloto_presupuestos  filas=3   tenants_visibles=3
```

| Dato | Valor |
|---|---|
| Tablas en `uc_factory` | **77**, todas con RLS activado |
| Con `FORCE` | **5** |
| Owner de las 77 | `uc_factory` — **el mismo rol que usa la app** |
| Policies sin `WITH CHECK` | **65 de 70** (filtran la lectura; no impiden **escribir** como otro) |

**No había fuga.** El aislamiento lo daban (y lo siguen dando) los `WHERE cliente_id` de cada store,
con sus 8 tests adversariales. Lo que no había era **segunda línea**: una query nueva que olvide el
filtro devuelve datos ajenos **sin error y sin síntoma** — exactamente el modo de fallo que el RLS
existe para prevenir.

**Lo que más duele: estaba escrito.** El docstring de `test_adversarial_multitenant.py` decía, desde
que se creó, *"el worker usa el rol OWNER de DATABASE_URL (**bypassa RLS**)"*. Documentado y **sin
pagar**: sin TODO, sin dueño, sin fecha. Es [[cero-deuda-no-gestionada]] en su forma más cara — la
deuda **conocida** que nadie convirtió en tarea. Y otra vez: **una advertencia escrita no es una
defensa** ([[provisionado-no-reconstruye-la-base-desde-cero]] enseñó lo mismo con otro disfraz).

## Las tres trampas de verificar RLS, todas pisadas en un día

1. **El dueño está exento sin `FORCE`.** Es la raíz de este caso.
2. **Un rol `SUPERUSER` o con `BYPASSRLS` saltea el RLS *incluso con `FORCE`*.** El spike dio "no
   funciona nada" en su primera corrida por esto, y estuvo a punto de hacerme descartar un mecanismo
   correcto. **El CI corría igual** — con superuser, así que cualquier test de aislamiento habría dado
   verde sobre un aislamiento inexistente. Guard permanente: `test_el_rol_de_la_app_NO_es_superuser`.
3. **`USING` sin `WITH CHECK`** filtra lo que se lee, no lo que se escribe: se puede insertar una fila
   con el `cliente_id` de otro.

**El control que las caza a las tres, y es uno solo:** conectarse **sin declarar tenant** y contar.
Si devuelve filas, el RLS no está aplicando — no importa lo que diga `pg_tables.rowsecurity`.

## Por qué no se arregla con "activá FORCE"

La policy usaba `auth.jwt()`, la GUC que setea PostgREST. La app se conecta directo con `psycopg2`,
donde eso es `null` → activar `FORCE` haría que **toda query devuelva 0 filas**. Hace falta que la app
**declare el tenant a la conexión** (`SET request.jwt.claims`), y que ese tenant venga del **borde**
(auth HTTP / interceptor de activities), nunca del llamador: si fuera un parámetro más, el RLS pasaría
a proteger contra errores de tipeo en vez de contra errores de lógica.

⚠️ **Y un detalle que rompe todo en silencio:** una dependencia **sync** de FastAPI corre en un
threadpool y el `ContextVar` que setea **no llega al handler** (medido: `{'visto': None}`). Tiene que
ser `async` — ahí sí llega, y además sobrevive a `asyncio.to_thread`, que es donde corren los stores.

Implementación y estado → `docs/copiloto-emprendedor/Manejo de errores/05-ESTADO-VIVO-rls-y-fases.md`.
