---
name: un-gate-que-valida-el-contenido-no-ve-que-el-archivo-esta-en-conflicto
description: sprint-estado.py --check dio CHECK-OK con los 6 marcadores de conflicto de git vivos en el doc; valida fichas, no integridad del archivo.
metadata:
  type: feedback
---

**Medido el 2026-11-04**, resolviendo el conflicto de `2026-11-02-BACKLOG-sprint-correcciones-mapa.md`
en `planificacion/marcar-n58`: con **seis** marcadores `<<<<<<<` / `=======` / `>>>>>>>` vivos en el
archivo, `sprint-estado.py --tabla` regeneró la tabla y `--check` dijo **`CHECK-OK`** — «99 fichas,
todos los TERMINADO con sha en origin/main». El gate es correcto en lo que mide (estado, `Cierre:`,
sha ancestro, tabla sincronizada) y **ciego a que el archivo que mide está partido en dos versiones**.

**Por qué muerde.** El parser toma el primer `- **Estado:**` que encuentra por ficha, y en un hunk en
conflicto ése es el del lado `HEAD`. O sea: **lee una mitad y la informa como si fuera el doc**. El
`CHECK-OK` no dice «el doc está bien», dice «la mitad que leí está bien» — y es indistinguible de un
verde legítimo. Si no hubiera mirado `git status` (`UU`), commiteaba los marcadores con el gate en
verde y la cifra 94/99 medida sobre medio archivo.

**Y hubo un segundo instrumento mintiendo en la misma operación:** el `.md` es **CRLF**, así que un
regex que ancla `^=======$` con `\n` **matchea cero** y el resolvedor sale «exitoso» sin tocar un solo
marcador — dos veces seguidas, con el `assert` disparando en silencio mientras el resto del script
seguía. Medir el separador antes de anclar (`[[anclar-texto-multilinea-sin-medir-el-separador-de-linea]]`)
no es una precaución de Windows: acá fue la diferencia entre resolver y creer que resolví.

**Cómo aplicarlo:** antes de citar un `--check` verde sobre un doc que acabás de mergear, corré
`git status --short <doc>` o `grep -c '^<<<<<<< '`. Un gate que valida **contenido** no acredita
**integridad del archivo**, y el verde de uno se lee como el verde del otro.
Relacionado: [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] ·
[[instrumento-que-no-mira-nunca-falla]] · [[resolver-tomando-un-lado-nunca-converge]].
