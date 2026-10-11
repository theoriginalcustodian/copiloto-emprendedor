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
