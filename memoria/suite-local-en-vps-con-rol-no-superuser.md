---
name: suite-local-en-vps-con-rol-no-superuser
description: La suite entera corre en 24 s contra un Postgres efímero del VPS con rol NO-superuser — el CI de GitHub es gate final, no consola de errores
metadata:
  type: feedback
---

**Usar el CI de GitHub para descubrir en qué falla un cambio cuesta ~8 minutos por iteración. La misma
suite corre en el VPS en 24 segundos.** El CI es el **gate** que bloquea el merge; no es el lugar donde
uno se entera de las cosas.

```bash
bash deploy/copiloto/test-db.sh --recreate      # Postgres 17 efímero en el VPS, imprime la URL
export UC_TEST_DATABASE_URL='<la url>'
bash deploy/copiloto/sync-test-backend.sh "tests ../../motor -q"
```

Los dos scripts ya existían; lo que faltaba era **el rol**.

## El rol importa más que la base (2026-07-31)

`test-db.sh` entregaba la URL de `postgres`, que es **SUPERUSER** — y un superuser saltea RLS *incluso
con `FORCE`*. Su propio comentario lo decía sin alarma: *"los tests abren la conexión como admin, que
bypassea RLS igual"*. O sea: **cualquier test de aislamiento daba verde sobre un aislamiento
inexistente**. El mismo defecto que tenía el CI, en el instrumento que iba a reemplazarlo.

Ahora entrega `copiloto_app` (NOSUPERUSER NOBYPASSRLS, dueño de sus tablas, igual que producción) y
**aborta** si el rol no cumple, antes de que nadie use la base. `--admin` vuelve al rol viejo y lo dice
en pantalla. Al cambiar de rol hace falta `--recreate`: las tablas viejas son de `postgres`.

**Si un test pasa con `--admin` y falla sin él, el rojo es el dato correcto.**
[[instrumentos-que-confirman-en-vez-de-verificar]]

## Sesiones en paralelo

`UC_TEST_STAGE` da a cada corrida su propio stage en el VPS (`sync-test-backend.sh` hace `rm -rf` del
suyo). Sin eso, dos corridas simultáneas se borran el árbol entre sí. La base **sí** se comparte: no
molesta porque cada test usa `cliente_id` aleatorios.

⚠️ El `tar` del sync falla con *"file changed as we read it"* si otra sesión está editando `tests/` en
ese momento. Es ruido de checkout compartido, no un fallo del cambio: reintentar.
