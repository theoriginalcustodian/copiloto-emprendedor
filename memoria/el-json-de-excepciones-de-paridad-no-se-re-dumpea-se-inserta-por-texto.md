---
name: el-json-de-excepciones-de-paridad-no-se-re-dumpea-se-inserta-por-texto
description: scripts/ci/testid-paridad-excepciones.json se edita por inserción de texto preservando CRLF; json.load+json.dump reordena claves y mete un diff de cientos de líneas
metadata:
  type: feedback
---

El gate `python scripts/ci/testid_paridad.py --check` mide por **pantalla = módulo**. Un testID que existe sólo en un lado
(p. ej. `feedback-bajada`: mobile vive en `modules/feedback`, web en `modules/ajustes`) pide una **excepción por id con
motivo + fecha** en `scripts/ci/testid-paridad-excepciones.json`.

**Why:** re-escribir el JSON con `json.load` + `json.dumps` cambia el orden de claves y los separadores; un cambio de 2
entradas pasa a ser un diff de cientos de líneas que además pisa lo que otra sesión agregó en paralelo (checkout compartido).

**How to apply:** insertar el bloque nuevo **por texto** junto a las entradas vecinas, respetando CRLF (el working tree de
Windows es CRLF); correr `--check` y exigir «0 sin cubrir, 0 obsoletas». Antes de agregar una excepción, preguntar si el
testID se puede agregar del otro lado: casi siempre es más barato que declarar la asimetría (acá se hizo así con
`midia-nota` y `feedback-bajada` en web).
