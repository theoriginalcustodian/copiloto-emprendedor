---
name: un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo
description: Un verificador que consulta una tabla con RLS FORCE sin declarar tenant devuelve 0 SIEMPRE y lo reporta como ausencia. El cero de una query con RLS no es un dato hasta saber si el rol puede ver — control de ceguera antes de contar
metadata:
  type: project
---

**Medido el 2026-08-02.** `deploy/copiloto/verificar-autosanacion.py` —escrito ese mismo día para
cazar instrumentos que mienten— reportó **"0 traumas"** y **"el canario nunca se disparó"** mientras
la fila del canario estaba en la tabla: `id 14, ErrorDeCanario, POST /salud/canario, 00:40:38 UTC`.

Causa: consultaba con un DSN de la app, cuyo rol está sujeto a **RLS `FORCE`**, y sin declarar la GUC
de tenant. Con la policy activa y sin tenant, `select count(*)` devuelve **0 siempre**. El script
publicaba ese cero como *ausencia* cuando era *ceguera*.

## Por qué es la peor forma de mentir

Un permiso denegado normalmente **grita**: `permission denied`, excepción, 403. RLS no: filtra filas
en silencio y devuelve un resultado **sintácticamente perfecto**. El cero que sale de una policy es
indistinguible del cero que sale de una tabla vacía — y en un verificador de salud, "vacío" es
justamente el estado que se espera. La mentira encaja exactamente con la hipótesis.

Es [[rls-activado-que-no-filtraba-el-dueno-esta-exento]] en espejo: allá el control no filtraba y
parecía que sí; acá filtra de más y parece que no hay nada.

## El control: preguntar por la CEGUERA antes de contar

```sql
select current_user,
       coalesce((select rolbypassrls from pg_roles where rolname = current_user), false)
```

Si el rol no saltea RLS, el verificador **no publica ningún número**: dice que la medida sería
ceguera. Cuesta una query y evita publicar un cero que no significa nada. Es el mismo principio que
[[vacio-no-es-hallazgo-correr-el-control]], aplicado al permiso en vez de al dato: *antes de creerle
a un vacío, preguntá si podías haber visto algo*.

**Y el rol correcto importa tanto como el control.** Un auditor global (uno para toda la app, no uno
por tenant) tiene que consultar con el rol del ciclo (`BYPASSRLS`), no con el de la app. Usar el DSN
de la app para una medida global es pedirle a una herramienta multi-tenant una respuesta que su
diseño le prohíbe dar.

## El detalle que se lleva media hora si no se sabe

El rol del ciclo **no tiene `uc_factory` en su `search_path`** → `relation "copiloto_traumas" does not
exist`. Calificar el schema siempre (`uc_factory.copiloto_traumas`): depender del `search_path` es
depender de la configuración de un rol que el script no controla.

## Lo que más enseña

**El verificador cometió el error que fue escrito para cazar**, el mismo día. Escribir el catálogo de
un patrón no inmuniza contra él: la pregunta *"¿qué devolvería esto si lo que mido estuviera roto?"*
hay que hacérsela **a cada instrumento nuevo**, incluido el que audita a los demás. Y hay una asimetría
que lo hace fácil de pasar por alto: verificar la lógica del instrumento no verifica sus **permisos**.
