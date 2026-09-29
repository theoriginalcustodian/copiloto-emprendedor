---
name: el-puntero-al-doc-actual-sobrevive-a-la-ronda-que-describia
description: Tres docs de entrada decían "actual/vigente/empezá por" apuntando a una ronda cerrada seis semanas antes. Nada falla cuando caducan, y mandan a una sesión entera al ciclo equivocado.
metadata:
  type: feedback
---

El 2026-09-23, en una noche, aparecieron **tres** punteros de entrada apuntando a estados cerrados:

| Archivo | Decía | Hacía |
|---|---|---|
| `HANDOFF.md` §1 | sprint CONSOLA 🔥 «en curso» | cerró el 2026-08-07 |
| `Auditorias/README.md` | «**Empezá por** el informe de cierre G8» | ronda cerrada el 2026-08-12 |
| `CLAUDE.md` §5 | «Doc maestro **actual**: …2026-08-04…» | superado hace seis semanas |

**Por qué caducan sin que nadie lo note.** El puntero se escribe cuando la cosa apuntada *es* lo
actual, y en ese momento es verdad. Después cierra la ronda — se escribe su informe de cierre, se
archiva, se celebra — y **nada en ese ritual toca a quien la señalaba desde afuera**. El link sigue
resolviendo, el archivo existe, ningún test falla, ningún gate se pone rojo. La única señal sería
que alguien note la fecha, y justamente la lee quien todavía no conoce el proyecto.

**Por qué muerde más que un dato viejo cualquiera.** Estos viven en los archivos que se leen
**primero** y **con confianza**: `CLAUDE.md` lo lee toda sesión al arrancar. Un dato vencido en el
cuerpo de un doc se cruza con otros y se corrige; un puntero de entrada vencido **decide qué leés
después**, y el resto de la sesión hereda el ciclo equivocado sin contradicción visible. Es
[[el-nombre-es-una-hipotesis-sobre-el-contenido]] a escala de documento.

**La regla que faltaba, y va al cierre de ronda:** cerrar una ronda incluye **barrer quién la
señalaba**. No es memoria ni disciplina — es un `grep`:

```bash
grep -rlnE "(vigente|actual|en curso|Empez[áa] por|punto de entrada)" \
  *.md docs/**/README.md | xargs grep -lE "<fecha-de-la-ronda-que-cierra>"
```

Los tres salieron así, de un barrido, **no de tropezarse con ellos**. Y el barrido tiene su propio
control: de los cinco hits, uno era falso positivo (`DESIGN-SYSTEM-EXTRACT-WEB.md`, donde «vigente»
califica un HTML fuente y no un estado) y dos eran docs con fecha en el nombre, que se declaran
históricos solos. Leer los hits antes de editarlos es parte del método, no un extra.

**Corolario de redacción:** cuando actualices uno, no borres a dónde apuntaba — decí *«hasta tal
fecha esto apuntaba a X, que sigue siendo el maestro de aquella ronda»*. Un puntero que cambia sin
decir qué reemplazó deja huérfano al que buscaba lo viejo con razón.

Relacionado: [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]] ·
[[propagar-cierre-a-docs-maestros]] · [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]
