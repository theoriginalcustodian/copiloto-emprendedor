---
name: el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas
description: Un control positivo hecho con un artefacto viejo no detecta una vista rancia del remoto — pasa igual en el mundo sano y en el enfermo, porque lo viejo está en las refs viejas también. El canario tiene que poder fallar por la causa exacta que temés, y eso incluye su EDAD
metadata:
  type: feedback
---

**El caso (2026-09-29, auditoría).** Barrí las ramas remotas buscando `scripts/plan-drift-check.sh`,
que planificación había anunciado como existente. Cero resultados. Apliqué el canon —*un vacío no es
hallazgo sin control positivo*— y horneé uno: el mismo barrido **sí** encontraba
`scripts/inventario-ola.sh`. Control verde ⇒ reporté «no existe en ninguna de las 188 ramas remotas».

**Era falso.** Existe en `origin/main`, existe en `bbce99c0`, y vive en **8 de 192** refs remotas.

## Por qué el control no podía cazarlo

Dos causas que se suman, y la segunda es la que importa:

1. **Mis refs remotas estaban rancias.** Mi barrido examinó **188** refs; el mismo barrido, corrido
   veinte minutos después (tras el `git fetch` que dispara el hook de mi propio push), examina **192**.
   El archivo había nacido **ese mismo día**.
2. **Mi canario tenía ocho días.** `inventario-ola.sh` es del 22/09; lo que buscaba era del 29/09. Un
   artefacto viejo **está en las refs viejas también** — así que el control pasa en el mundo sano *y*
   en el mundo donde mi vista del remoto está desactualizada. No discrimina entre los dos. Sólo probó
   que la búsqueda encuentra cosas viejas, que es exactamente lo que un instrumento rancio sigue
   haciendo bien.

## La regla

**El canario tiene que ser tan nuevo como lo que buscás.** Más general: *un control positivo que no
puede fallar por la causa que temés no es control de esa causa* — es decoración que produce confianza.
Antes de horneralo, escribí cuál es la causa temida y preguntá **«¿en qué mundo este canario saldría
rojo?»**. Si la respuesta no incluye el mundo que te preocupa, el canario está mal elegido.

Concretamente, para un barrido sobre refs remotas: el canario es **algo creado hoy**, no lo primero
que tengas a mano. Y si no hay nada nuevo que sirva, el control es otro: `git fetch` explícito y
comparar el conteo de refs antes y después.

## Lo que hace este caso peligroso

Lo cometí **dos veces el mismo día, en dos ejes distintos**, y las dos veces con el control en verde:

- Acá, por **edad**: canario viejo contra una vista rancia.
- Esa misma mañana, por **cobertura**: mi cruce leía dos documentos y elegí los dos ids de control
  del *mismo* documento, así que el control pasaba sin que el otro se leyera nunca
  ([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).

El patrón común no es el olvido: es **elegir el canario por disponibilidad en vez de por poder
discriminante**. Lo que tenés a mano es, por construcción, lo viejo y lo cercano — las dos propiedades
que lo vuelven ciego. Emparentado con [[el-canario-el-control-positivo-de-lo-que-falla-callado]] (un
vigilante que no puede fallar no informa) y con
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] (el instrumento contesta «no hay» cuando
lo cierto es «no veo»).

**Y el costo real:** un falso «no existe» no queda en mi cuaderno. Lo reporté a planificación como
hallazgo sobre *su* trabajo. Un instrumento mal controlado no sólo se equivoca: **acusa a otro**
([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).
