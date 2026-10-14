---
name: python-heredoc-con-dev-null-abre-un-repl-en-bucle
description: "`python -I - <<EOF ... </dev/null` abre un REPL (el 2º redirect pisa el heredoc) que en background escribió 1,9 GB al task output"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8b4c92c0-372e-46d5-b6b5-3a55993f8120
  modified: 2026-10-14T06:48:35.431Z
---

`python -I - <<'EOF' … EOF` con un `</dev/null` en la misma línea: el último redirect de stdin gana, así que
python no lee el script, entra al REPL y —sin consola— falla en bucle imprimiendo el traceback de `_pyrepl`
al archivo de salida de la tarea. En background llegó a **1,9 GB en minutos** (2026-10-14, mismo mecanismo
que el 84 GB del disco lleno).

**Why:** el `</dev/null` lo agregué por reflejo de la regla «python en background nunca pelado»; combinado con
`-` (script por stdin) la anula. Un REPL sin tty es un bucle de escritura sin freno.

**How to apply:** nunca script por stdin en background. `Write` del `.py` al scratchpad y `python -I script.py
</dev/null` con `timeout`. Si una tarea background crece sin razón: `TaskStop`, `taskkill` del `python.exe`, y
borrar el `.output`. Relacionado: [[silencio-del-buzon-no-prueba-repl-muerta]].
