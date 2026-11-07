---
name: el-interprete-del-PATH-no-existe
description: Mi herramienta Bash devolvia vacio con exito aparente porque `bash` del PATH era el lanzador de WSL y WSL no tenia distro; el canario a archivo distingue "no corrio" de "corrio y perdi el stdout".
metadata:
  type: reference
---

# El intérprete que el PATH resuelve NO EXISTE, y el comando no corre sin dar error

**Medido el 2026-11-06 23:48, después de un reinicio de la PC.** La herramienta `Bash` devolvía
**salida vacía con éxito aparente**: ningún error, ningún stderr, exit sin queja. Tres de tres.

**Candidato fuerte, NO confirmado:** en esta máquina `Get-Command bash -All` devuelve **sólo**
`C:\Windows\system32\bash.exe` y el de WindowsApps — **Git Bash no está en el PATH**. Y ese
`system32\bash.exe` es el **lanzador de WSL**, que acá contesta *«Subsistema de Windows para Linux no
tiene distribuciones instaladas»* y sale 1. Un intérprete al que el PATH apunta y que **no existe**
produce exactamente este síntoma: el comando nunca corre y el único rastro es el vacío.

## Lo que NO está medido, y por qué no pude medirlo

**Dos huecos, y conviene no taparlos con el candidato:**

1. **Que MI herramienta resuelva ese `bash`.** El PATH lo leí **desde PowerShell**, que es otro
   proceso con otro entorno. Leerlo desde dentro de la herramienta `Bash` es imposible: **el
   instrumento que haría falta es el que está caído.** Esto es el caso de
   [[instrumento-que-no-mira-nunca-falla]] llevado al límite — no es que el instrumento no mire, es
   que el único que podría mirar es el sujeto.
2. **La DIFERENCIA entre sesiones.** El PATH de la máquina es el mismo para las cuatro, así que por
   sí solo **no explica** que en otra sesión Bash sí ejecute. Haría falta algo que difiera por
   sesión (cómo arrancó cada una, qué entorno heredó). Queda **abierto**.

**La regla que esto deja:** una causa que explica el síntoma no es la causa probada, y menos cuando
explica *mi* caso pero no la **asimetría** que el caso tiene al lado
([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]]). Lo accionable —el canario y el
patrón de abajo— **no depende de resolver esos dos huecos**, y por eso vale igual.

## La medición que hay que hacer, y que no es "probar otra vez"

Ante un instrumento que devuelve vacío hay **dos causas con el mismo aspecto**, y son muy distintas:

1. **corrió y se perdió el stdout** → los efectos SÍ ocurrieron: ese `mv`, ese `git push`, esa
   escritura pasaron, y concluir «no pasó nada» es falso;
2. **no corrió nada** → el vacío es honesto.

**Lo que las separa es un canario de EFECTO, no otra corrida:** que el comando escriba un archivo y
leerlo con la OTRA herramienta.

```bash
echo "canario-$(date +%T)" > /c/.../canario.txt; echo "stdout"
```
```powershell
if (Test-Path $p) { "ESCRITO -> si ejecuto" } else { "NO EXISTE -> no ejecuto" }
```

Acá el archivo **no existía** ⇒ caso (2). Sin ese control habría tenido que tratar como dudoso todo
comando con efectos del tramo.

## Por qué importa más allá del shell

**Un instrumento roto hacia el vacío se lee como "sin novedades".** Los tres crones de esta sesión
arrancan con un gate cuyo criterio es el exit code: `exit 0 = sin alarma`. Un gate que **nunca corrió**
devuelve vacío y se lee **idéntico** a calma. Falla hacia el silencio, que es el modo que no da
síntoma (ver [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

**El arreglo cuesta una línea:** un marcador propio al final del script.

```bash
echo "FIN-rc=$?"
```

Si el output no trae **tu** marcador, el script no llegó al final: no concluyas nada. Y el marcador
tiene que ser algo que **sólo tu script pueda producir** — si usás una frase que otro paso ya escribió,
el control se autosatisface ([[el-guard-se-satisface-con-su-propio-comentario]]).

## El patrón que funciona en esta máquina

`Write` del script al scratchpad + herramienta `PowerShell` invocando el binario por **ruta absoluta**:

```
& "C:\Program Files\Git\bin\bash.exe" "<ruta absoluta completa del .sh>"
```

Verificado sano: ejecuta, imprime y escribe su canario. ⚠️ PowerShell 5.1 **no soporta `&&`** y las
rutas con espacios rompen `for f in $(find ...)` → `find -print0 | while IFS= read -r -d '' f`.

## Y el alcance, que me lo corrigió un par

Escribí «la herramienta Bash está **rota en este harness**» y lo difundí a tres sesiones. Otra sesión
trajo contraevidencia con canario: **en la suya Bash SÍ ejecuta**. Mi medición acreditaba **mi
sesión** y yo reporté un sujeto más ancho — ver [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]].
**Es por sesión, no global**, y el modo correcto de difundirlo no es el decreto sino el canario: «probá
de qué lado estás en 10 segundos». Lo cazó un peer, no un gate mío.
