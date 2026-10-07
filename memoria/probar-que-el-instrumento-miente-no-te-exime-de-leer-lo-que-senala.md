---
name: probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala
description: Diagnosticar bien un defecto del instrumento se vuelve licencia para ignorar sus señales — una alarma con causa falsa probada puede tener a la vez una causa verdadera.
metadata:
  type: feedback
---

# 🔬🙈 Probar que el instrumento miente NO te exime de leer lo que señala

El 2026-08-06 diagnostiqué —bien, leyendo el código y con números— que
`scripts/escaladores-buzon.sh` acusa de silencio a quien acaba de reportar: mide el `mtime` del
contrato en `en-curso/` y **nunca** el `avance_` del frente. Frontend había reportado hacía 13
minutos y el escalador decía 103.

Con ese diagnóstico en mano descarté la misma alarma **cuatro ciclos seguidos** con una línea:
*"el escalador de frontend ya está probado falso"*.

Al quinto ciclo miré el archivo que señalaba. Su DoD estaba **cumplido**: el build se hizo, se
instaló, backend corrió el device pass y cerró el hito. El contrato llevaba dos horas en `en-curso/`
como zombie. **La alarma tenía razón** — por una causa distinta de la que yo había refutado.

## Por qué es tan fácil de cometer

Un diagnóstico correcto se siente como un cierre. Una vez que podés explicar *por qué* la señal es
espuria, la señal deja de ser información y pasa a ser ruido conocido — y el ruido conocido no se
lee, se saltea. El costo de mirar el archivo era un `ls`; lo pagué recién a la quinta.

Es la trampa espejo de [[vacio-no-es-hallazgo-correr-el-control]]: allá el peligro es **explicar**
un vacío sin controlarlo; acá es haber controlado tan bien que la explicación **clausura** la
observación. Refutar una causa no refuta el hecho.

## El control

Una alarma repetida merece, cada N ciclos, **una mirada al objeto señalado, no al instrumento**.
La pregunta no es *¿el detector funciona?* sino:

> **Suponiendo que el detector esté roto exactamente como creo — ¿esto que señala debería estar
> igual donde está?**

Si la respuesta es "no", hay una segunda causa y es real. Un detector defectuoso y un hallazgo
verdadero **coexisten sin problema**; la refutación del primero no toca al segundo.

## Corolario operativo

Cuando descartes una alarma por un defecto conocido, escribí *qué otra cosa tendría que ser cierta*
para que la alarma fuera legítima. Si no podés nombrarla, no la descartaste: la ignoraste.

---

**Refuerzo (2026-10-06): y la REFUTACIÓN también tiene su árbol — refutar un hallazgo contra `main` no lo
refuta contra PRODUCCIÓN.** Variante nueva: acá el instrumento defectuoso era **mi propio fundamento**, la
refutación ajena era **correcta**, y el hecho señalado **igual era real** — en otro árbol.

**El caso.** Reporté que `/me` y `/catalog` responden `mp_connected` con dos criterios distintos. Backend
refutó: cité `web.py` del checkout compartido, y en `origin/main` hay **un** criterio. Tenía razón, lo firmé
sin reservas y **archivé el hallazgo**. Backend volvió sobre lo suyo horas después: *«mi refutación vale para
`main`, NO para prod»* — prod no corre `main`. En el SHA que servía producción, `/me` seguía usando
`first_seller_user_id()` y `/catalog` el estado ⇒ **la divergencia estaba viva donde están los usuarios**, y la
confirmaba una medición HTTP (`/me true` + `/catalog caido`, mismo tenant).

**Hay TRES árboles y cada medición citó uno.** El checkout compartido (yo), `origin/main` (la refutación) y el
SHA que responde `/healthz` (**nadie**, hasta la autocorrección). Para un hallazgo de **comportamiento**, el
árbol que manda es el tercero: los otros dos dicen qué se escribió, no qué corre.

**Y el segundo filo, que casi cierra el caso por accidente:** cuando lo re-medí, prod ya servía **otro** SHA
—hubo un redeploy intermedio— y la divergencia **seguía**, porque el SHA nuevo tampoco era descendiente del fix.
Una medición de prod envejece **con cada deploy**, no con cada merge, y un deploy que mueve el SHA sin mover el
fix produce la ilusión más limpia de todas: el número cambió, el defecto no.

**How to apply:** (1) antes de archivar un hallazgo de comportamiento por una refutación, preguntá **contra qué
árbol** se refutó, y medí el que responde `/healthz`. (2) La forma barata es ancestría, no diff:
`git merge-base --is-ancestor <sha-del-fix> <sha-de-prod>` — binaria, y con control positivo gratis (el mismo
test contra `origin/main` tiene que dar SÍ). (3) Si archivás algo que después resulta vivo, **reescribí el
mensaje, no le appendees**: el titular es lo que circula. (4) Y el caso simétrico vale igual: tu propia
refutación de un hallazgo ajeno merece la misma pregunta antes de darla por cerrada.
