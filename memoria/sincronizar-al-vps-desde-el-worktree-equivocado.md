---
name: sincronizar-al-vps-desde-el-worktree-equivocado
description: Sincronizar al VPS desde el worktree equivocado tumba el servicio — el VPS no es un repo git y no avisa
metadata: 
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-07-21T21:54:15.828Z
---

**LEER antes de hacer `tar | ssh` o `scp` de código al VPS.** El 2026-07-21 el front-door quedó en
restart loop ~1 minuto (`ImportError: cannot import name 'make_consultar_anulacion'`) por sincronizar
`web.py` desde `copiloto-emprendedor/` (rama del frontend) cuando el servicio corre el código de
`_copiloto-afip-wt/` (rama `feat/facturacion-afip-determinista`).

**Por qué no lo cazó nada:** `/opt/uc-repos/copiloto` **no es un repo git** — es el destino de un
rsync. No hay `git status` que muestre el drift, ni conflicto, ni diff: el archivo viejo se pisa en
silencio y el error recién aparece al reiniciar. Y el proceso vivo sigue con su código en memoria,
así que entre el sync y el restart todo *parece* normal.

**El agravante:** los tests pasaron igual (29 verdes) sobre el archivo equivocado, y dos fallos que
achaqué al env eran en realidad porque el `test_connect_endpoints.py` de esa rama estaba
desactualizado (`MP_FERNET_KEY` en vez de `COPILOTO_FERNET_KEY`). Verde en la rama equivocada no
prueba nada sobre lo desplegado.

**Cómo evitarlo:** antes de sincronizar, confirmar que el archivo local contiene lo que el VPS ya
tiene. Barato y binario: `grep -c <símbolo_que_sólo_está_en_prod> <archivo_local>` — acá habría sido
`make_consultar_anulacion`. Cero es "estás en la rama equivocada, no sincronices".

Se relaciona con [[instrumentos-que-confirman-en-vez-de-verificar]] y con la regla global de sesiones
paralelas: los worktrees aíslan el código, **no** el estado compartido — y el VPS es estado
compartido.
