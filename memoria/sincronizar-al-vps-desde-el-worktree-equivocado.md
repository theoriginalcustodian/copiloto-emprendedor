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

**Segunda cara del mismo filo (2026-07-22): el worktree no es el equivocado, es el VIEJO.** Creé un
worktree `off main` para trabajar, y mientras codeaba las OTRAS dos sesiones mergearon a `main` (modelo
de 3 sesiones). Mi worktree quedó basado en un `main` de hace minutos — le faltaba el grafo log
(`evento_store.py` + ganchos). `deploy.sh` hace `rm -rf $REMOTE/apps/copiloto` y untarea el worktree:
deployar desde ahí **habría borrado `evento_store.py` de prod** y tumbado todos los stores que lo
importan. Los tests pasaron igual (mi base no tenía los ganchos, así que no había nada que romper) —
verde en un árbol viejo tampoco prueba nada sobre lo desplegado. Lo cazó `git diff --stat origin/main
-- apps/copiloto motor deploy` que mostró DELECIONES (evento_store `-91`, test_grafo_log `-240`).

**La regla que sale de las dos:** **nunca deployás desde tu worktree de trabajo.** Deployás desde un
checkout FRESCO de `origin/main` (`git fetch` + `git worktree add --detach ../_wt-deploy origin/main`),
tras confirmar el merge. Y antes de tirar el gatillo: `git diff --stat origin/main -- <superficie de
deploy>` **tiene que salir vacío** — cualquier línea (y sobre todo cualquier `-`) es "vas a pisar
prod con algo que no es `main`".

Se relaciona con [[instrumentos-que-confirman-en-vez-de-verificar]] y con la regla global de sesiones
paralelas: los worktrees aíslan el código, **no** el estado compartido — y el VPS es estado
compartido.
