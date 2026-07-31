---
name: kill-switch-por-env-no-es-inmediato-bajo-systemd
description: Leer os.environ en cada decisión NO hace que un kill switch surta efecto sin reiniciar — systemd fija el entorno del proceso al arrancar
metadata:
  type: project
---

# 🔌⏱️ Un kill switch por env var NO es inmediato bajo systemd

`autosanacion_gates.apagado()` lee `os.environ` en **cada** decisión, y su docstring afirmaba que
por eso apagarlo *"tiene que surtir efecto sin reiniciar el worker — si hiciera falta un reinicio,
no sería un kill switch"*. La primera mitad es cierta; la conclusión es falsa.

**Medido en el VPS (2026-07-31), no deducido:** el worker corre bajo systemd con
`EnvironmentFile=/etc/unreal-copilot/copiloto.env`, y systemd fija el entorno del proceso **al
arrancar**. Editar el archivo no cambia el `environ` de un proceso vivo. Se verificó leyendo
`/proc/<pid>/environ` del worker: la variable no estaba ahí — y tampoco estaba declarada en el
archivo, así que el kill switch **no se podía activar de ninguna forma** sin editar y reiniciar.

**Por qué el error es fácil y no da síntoma.** El razonamiento *"lo leo en cada llamada ⇒ es
dinámico"* es correcto **dentro del proceso** y el test lo confirma: `monkeypatch.setenv` sí cambia
`os.environ` en caliente, y el test *"el kill switch se lee en CADA decisión, no al arrancar"* pasa
en verde. Pero mide el módulo, no el despliegue. La frontera que ninguna de las dos mitades vigila
es **quién le pone el `environ` al proceso en producción**.

Y el fallo es del peor tipo: no se descubre hasta que hace falta apagar algo con urgencia.

## Lo que sí es inmediato

Pausar el Schedule. No toca el proceso, surte efecto en el momento, y se verifica releyendo el
estado del servidor en vez de contar llamadas que no lanzaron:

```
python deploy/worker/verificar_autosanacion.py --pausar-todo
```

La env var sigue valiendo (un `systemctl restart` alcanza, no hace falta redesplegar), pero es el
apagado **lento**. Un apagado de emergencia que se cree instantáneo y no lo es, es peor que uno que
se sabe lento: se confía en él justo cuando no hay que confiar.

## La regla

Todo interruptor de emergencia tiene que declarar **cuánto tarda en surtir efecto y qué hace falta
para que lo haga**, verificado contra el proceso vivo. Si el mecanismo es una env var y el proceso
corre bajo un supervisor, el default es que **no** es inmediato — salvo prueba en contrario, y la
prueba es `/proc/<pid>/environ`, no el test unitario.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: acá el test verde medía el módulo
mientras la propiedad que importaba vivía en el despliegue. Y de
[[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] — `monkeypatch.setenv` no es el
camino por el que la variable llega en producción.
