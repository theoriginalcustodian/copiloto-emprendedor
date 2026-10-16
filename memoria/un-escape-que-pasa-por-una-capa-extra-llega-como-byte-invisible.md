---
name: un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible
description: Un \b escrito a través de heredoc o -c llega al archivo como \x08 literal; el regex queda imposible de satisfacer y grep/sed/el visor muestran la línea perfecta, así que el falso rojo acusa al sujeto correcto de un defecto propio
metadata:
  type: feedback
---

# 🫥 Un escape que pasa por UNA CAPA EXTRA llega como byte de control INVISIBLE

Cuando el código viaja por una capa intermedia antes del disco —`bash -c`, `python -c`, un heredoc no
citado, un `sed` con el patrón entre comillas dobles— cada capa **consume un nivel de escape**. Un `\b`
que uno escribió como *frontera de palabra* llega al archivo como **`\x08`**, el carácter de backspace.

**Lo que lo vuelve peor que un typo:** `grep`, `sed`, `cat` y cualquier visor muestran la línea
**perfecta**, porque un `\x08` no se dibuja. El defecto no está oculto en una esquina del repo: está en
la línea que estás leyendo, y **el instrumento de lectura lo borra de la pantalla**. Releer no sirve;
sólo sirve mirar los **bytes** (`cat -v`, o contar `b < 0x20`).

**Y el daño apunta al lugar equivocado.** Un regex con `\x08` **no lo satisface ningún texto**, así que
el gate sale rojo contra un sujeto que sí cumple. El falso rojo se lee igual que prudencia —y más si
uno ya sospechaba del documento—, de la familia de
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]].

## El caso (2026-10-11)

El gate del relevamiento mobile rechazaba C6 —«el doc no cita las 120 `.so` medidas dentro del APK»—
sobre un documento que **tenía** el texto. El mismo regex, tipeado de nuevo en un `python -c`, daba
match sobre el mismo archivo. La contradicción se resolvió extrayendo la función del fuente y
mirándola en `repr`:

```
"    if not re.search(r'\x08120\x08[^.]{0,80}\\.so|\\.so[^.]{0,80}\x08120\x08', t):"
```

Cuatro `\b` convertidos en cuatro backspaces por el heredoc que escribió el parche. Barrido de los
otros archivos del mismo heredoc (receta, documento, dos de memoria): **0 bytes de control** — el
daño estaba confinado, pero eso se **midió**, no se supuso.

## Las dos defensas

1. **No mandar código por una capa de más.** Un parche se escribe con la herramienta de escritura de
   archivos, no por heredoc: ésa es la capa que corrompe. Mismo peaje que
   [[git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos]].
2. **Que el instrumento mida su propio fuente.** El gate ganó un `C0` que escanea su `__file__` por
   bytes `< 0x20` y aborta. Verificado con control positivo: con un `\x08` inyectado a mano sale
   **exit 2**; sin él, verde ([[medir-si-un-gate-dispara-antes-de-embarcarlo]]).

## La trampa de segundo orden

El **primer** canario de ese guard salió **verde**, y por un segundo lo leí como «no hay nada que
cazar». No era eso: el `replace` que inyectaba el byte viajó por `bash -c` → `python -c` y **el byte
nunca llegó al archivo**. El mismo defecto que el canario venía a probar le impidió probarlo. Peor: su
propio `print` decía *«canario escrito con 1 byte de control»* — una frase **que yo escribí**, no una
medición ([[un-control-positivo-con-esperado-falso-acusa-al-script]]).

**Regla:** un canario de inyección **mide la inyección en el archivo** antes de correr nada, y si el
byte no está se declara **INVÁLIDO** en vez de absolver al guard. Un canario que no llegó a inyectar
y un guard que funciona dan **el mismo verde** — es el caso exacto de
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].

## Refuerzo 2026-10-12 · la capa extra puede ser **el código que escribe el código**

Hasta acá el caso era un byte de control que llegaba **de afuera** (un `` en un dato). Hoy me lo
infligió mi propia herramienta de edición: generando líneas de un script bash **desde un script
python**, escribí `tr -dc "\r"` esperando que quedara el literal de dos caracteres. Quedó un **CR
real (0x0D) incrustado en el fuente del `.sh`**.

Cómo se ve el defecto:

```
$ grep -n "tr -dc" scripts/ci/lint.sh
123:  echo "    (versionado $(tr -dc "" < "$_contratos" | wc -c) CR ...
                            ^^^^^^^^^^  el argumento se ve VACÍO
$ sed -n '123p' scripts/ci/lint.sh | od -c
0000040       "     "       <       "   $   _   c   o   n   t   r   a
```

Lo que lo hace peor que el caso original: **funcionaba**. `tr -dc "<CR>"` cuenta CR igual que
`tr -dc '\015'`. Un test lo habría dado verde. El daño es que el fuente queda **ilegible** (`grep`
muestra un argumento vacío, y un revisor lee «alguien se olvidó el patrón») y **frágil**: cualquier
normalización de fin de línea — un `.gitattributes`, un `dos2unix`, el propio `core.autocrlf` — se
come ese byte y cambia la semántica sin que nada falle. Un defecto que no da síntoma hasta que otra
herramienta toca el archivo.

**La defensa, más fuerte que contar capas:** cuando generes código que contiene escapes, **no
escribas el backslash: construílo**. `B = chr(92)` y después `"'%s015'" % B`. Un `chr(92)` no lo puede
colapsar ninguna capa intermedia. Y preferí el **octal ASCII** (`\015`) sobre `\r` en los scripts
generados: es inmune a la normalización de fin de línea y legible en cualquier visor.

**Y el control, que es de una línea:** después de generar, `od -c` o `cat -A` sobre las líneas
escritas — nunca `cat` ni el visor, que es justo lo que borra la evidencia. Acá el `grep` mostró
`tr -dc ""` y lo leí como «quedó vacío»; el `od -c` mostró el ``. Dos lecturas del mismo byte, y
sólo una dice la verdad.

**Reincidencia 2026-10-13 (H12, PR #1110): el byte cae en un TEST que afirma una AUSENCIA.** Un script Python
con `\b` en un string no-raw escribió un `0x08` dentro de `/tarjeta\.(monto|fecha)\b/` en dos tests de
«control de ceguera» (`not.toMatch`): la regex no puede matchear, así que pasaban verdes **vacíos** — y el
arreglo, escrito otra vez con `"\b"` en un string no-raw, volvió a meter el byte. Lo cazó `no-control-regex`
de eslint en CI, no mi suite. Reglas: `rb"\b"`; y un test `not.toMatch` exige **control positivo**
(`toMatch` sobre un token que SÍ está) y un **mutante** que lo ponga en rojo — también al re-escribirlo.

## Refuerzo 2026-10-16 — el mismo escape, una capa más adentro: `'\''` llegó como `'''`

Al extraer el acceso a prod a `scripts/lib/psql-prod.sh` tuve que pasar SQL por una cadena de ssh,
o sea `bash local → ssh → sh remoto → psql`. La comilla simple embebida se cierra con el truco POSIX
`'\''`, y lo escribí con `sed "s/'/'\\''/g"`. La capa extra se comió el backslash y **cada comilla
llegó como `'''`**, que el shell colapsa a **nada**:

```
quería:  -c 'select set_config('\''request.jwt.claims'\'', …)'
llegó:   -c 'select set_config('''request.jwt.claims''', …)'
o sea:   select set_config(request.jwt.claims, …)      <- SIN los literales
```

El SQL resultante es sintácticamente válido y semánticamente otra cosa: `request.jwt.claims` pasa a
ser un **identificador** que no existe. No es un error de escape que explota ruidosamente — es un
comando distinto que parece el mío.

**Lo que lo cazó no fue leer el código.** Fue un control de armado que no necesita red ni base:
redefinir `ssh` como una función que captura su último argumento, y ejecutar ese argumento con un
`psql` y un `systemctl` falsos en el `PATH` que imprimen lo que reciben. Tres líneas, y la salida
mostró el `'''` literal. El fix fue reemplazar el `sed` por expansión de bash (`${frag//$q/$esc}`),
que no tiene capa de interpretación propia.

**La regla, afilada:** cuando un string atraviesa N capas de interpretación, el escape no se razona
— se imprime en el destino final. Y el destino final no es «lo que mandé», es **lo que el último
proceso recibió como argv**. Un `echo` del comando no sirve: muestra la capa de donde salió.

**Y hubo una segunda vuelta del mismo patrón en la misma hora**, por si hacía falta la confirmación:
el parcheador que escribía el fix era un heredoc de bash con python adentro, y el `\b` del ancla del
guard read-only **tampoco sobrevivió** — el `assert ancla in s` falló tres veces seguidas contra un
archivo que sí contenía el texto. Primero lo resolví quitando los backslashes del ancla (buscar por
índices); después la tercera corrupción —los `\n` de un reemplazo convertidos en newlines reales—
dejó claro lo que correspondía: **escribir el script con la herramienta de escritura directa, no por
heredoc**. Cuando el problema es la cantidad de capas, la solución no es escapar mejor: es sacar una
capa.
