# ⛔ RETIRADO — no había nada que rescatar. Las 6 líneas las borró `main` a propósito.

> **El titular original de este doc era falso y decía:** *«6 líneas de prosa de diseño que no están
> en ningún commit; un `--ff-only` las borraba sin dejar rastro»*. **No.** Las 6 son redacción
> **vieja que `main` reemplazó o derogó por decisión firmada.** Portarlas no rescataba nada:
> revertía tres decisiones del operador.
>
> Se reescribe el titular en vez de appendear la corrección, porque de dos artefactos gana el que
> circula y un append deja el titular refutado al frente — que es justo el modo de falla que este
> doc estuvo a punto de causar.

**Refutado por frontend2 el 2026-11-03.** Verificado por planificación contra la historia de
`origin/main` antes de aceptarlo (no se le creyó por venir de un peer): los dos shas citados existen,
son **ancestros de `origin/main`**, y sus mensajes dicen literalmente lo que afirmó.

---

## El error, que es de método y no de cuidado

Mi medidor preguntó **«¿está esta prosa en `main`?»** y contestó, correctamente, **«no»**.
Y ahí paré. Ése es el defecto: *«no está en main»* **no es una conclusión, son dos mundos que la
pregunta no separa**:

1. nadie lo escribió todavía ⇒ **puede** ser trabajo pendiente;
2. **alguien lo borró a propósito** ⇒ rescatarlo es una **regresión**.

El discriminante es una sola línea — **`git log origin/main -S'<token>' -- <archivo>`** — y **no la
corrí**. Lo más caro del caso: ese paso está escrito, con esas palabras, en
`memoria/base-rancia-invierte-la-direccion-del-diff.md` §«El paso que faltaba: ¿y si un commit lo
BORRÓ a propósito?», y yo estaba **abriendo ese archivo para reforzarlo** con este hallazgo cuando
llegó la refutación. Tener la regla escrita no la aplica: la entrada se leyó como «ya cubierto».

Y hay una capa más, porque me había felicitado por el medidor equivocado. Antes de esto **dos
medidores propios se contradijeron** —`grep` de la frase decía «main la tiene», la línea completa
decía «ausente»— y resolví bien esa disputa: el núcleo de prosa sin markup es el sujeto correcto
**para la pregunta de la envoltura**. El problema es que respondida esa pregunta di por respondida
**otra**. Un medidor más fino sobre el eje equivocado da una respuesta más convincente, no más
verdadera.

## Las 6 líneas, una por una

| Línea del checkout | Qué pasó en `main` | Commit |
|---|---|---|
| «Todavía no se guardó nada» (11-voz l.293, mapa l.202/204) | **Reemplazada** por la frase canónica que decidió el operador el 2026-10-16 (DECISIONES 7 y 8): «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» `main` ya la trae. | `fffc3be8` (#1293) — *«la frase del aviso de la card de gasto es la del código (decisión 8)»* |
| las 2 de la pantalla `detalle` | **Derogada a propósito** por `SM-G2`: *«Sale la fila del sheet derogado»* | `e791cf5e` (#1346) |
| «en mobile no existe» (reveal, mapa l.174) | **Refutada por medición en device**: `main` dice «en mobile SÍ existe (`EntradaSesion`, medido en device 2026-11-02)» | `dc8d2ffa` (#1438) |

Control: `'todavía no lo anoté' in main → True` · `'EntradaSesion' in main → True`.

## Veredicto vigente

**El working tree del checkout compartido NO tiene prosa de diseño sin respaldo.** Lo que le falta a
`main` es exactamente lo que `main` descartó. Es el caso de libro de
[[base-rancia-invierte-la-direccion-del-diff]]: contra una base rancia, **lo que `main` quitó a
propósito se lee como trabajo propio pendiente**, y el reporte sale alarmado y coherente — no hay
nada falso en los datos, el defecto está en la pregunta.

**Consecuencia operativa:** los tres archivos divergentes son **descartables**, los 14 restantes se
resuelven solos al avanzar el HEAD, y el checkout compartido queda al día sin rescatar nada. El paso
que queda no es de contenido: es el `merge --ff-only`, que bajo CANON 9 no corre ninguna sesión
—tampoco planificación— sin decisión explícita del operador.

## Lo que sí sobrevive de este doc

Dos reglas, y valen más que el rescate que no existía:

1. **«No está en `main`» es una pregunta, no un veredicto.** Antes de rescatar: `git log -S`.
2. **Un peer que te refuta con shas se verifica, no se cree ni se descarta.** Los dos caminos
   fáciles fallan igual: aceptarlo por venir de un par, o defender lo propio por ser propio. Acá los
   shas se corrieron de nuevo y la refutación se sostuvo entera.

## 3. Un DoD expresado como CIFRA se puede cumplir con la premisa falsa (aporte de frontend2)

El DoD que bajé decía «las 6 líneas presentes en `main`, verificadas una por una». Es un **conteo**,
y un conteo es ejecutable sin que su premisa sea cierta: las 6 habrían quedado presentes, el punto 1
verde, y **las 3 decisiones del operador revertidas por debajo, acreditadas por un DoD cumplido**.
Eso es peor que no hacer el trabajo, porque queda firmado.

Lo que frenó a frontend2 no fue el DoD: fue haber visto en el diff una frase que el propio mapa trae
reescrita. Y su aritmética es la que decide — *contrastar por línea cuesta 3 comandos; ejecutar y
revertir cuesta un PR con DoD verde encima*.

**Regla:** un DoD que cuenta nunca puede ser el único punto. Necesita al menos uno que pregunte
**¿por qué falta esto?** — que acá era exactamente el `git log -S` que no corrí.
