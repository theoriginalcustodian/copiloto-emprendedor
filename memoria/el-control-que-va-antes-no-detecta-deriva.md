---
name: el-control-que-va-antes-no-detecta-deriva
description: Una serie monótona confunde el efecto con la deriva del sistema; el control va repetido DESPUÉS de la condición cara, no sólo antes, o la medición devuelve el resultado invertido.
metadata:
  node_type: memory
  type: feedback
---

Auditoría midió la latencia de `pres-hitl` con 0, 1 y 2 propuestas pendientes, **en ese orden**, con un
control de 0 tomado al principio. Resultado: 0 = 8,1 s · 1 = 8,1 s · **2 = 4,1 s**. Con más pendientes
tardaba la mitad.

La conclusión disponible era «las pendientes no influyen», y es **falsa**. El primer mensaje de cada
sesión carga ~3 s de arranque en frío, y en una secuencia creciente ese costo cae **entero sobre la
primera condición**. Lo que lo separó fue repetir el 0 **después** de las 2: dio 3,4 s, igual que el 0
previo — o sea la sesión no se había degradado, se había *calentado*. Con el control repetido, la
medición se dio vuelta: 1 pendiente = 1,4× y 2 pendientes = 3,2×, cada punto contra un 0 tomado en su
misma sesión. **Sí escala con la cantidad, y cada pendiente cuesta más que la anterior.**

**Why:** un control al principio es una **foto**; lo que detecta deriva es el control **repetido al
final**. Sin el segundo, «efecto de la condición» y «deriva del sistema a lo largo de la serie» son
indistinguibles, y una serie monótona (0→1→2, chico→grande, viejo→nuevo) las confunde por
construcción. Lo peligroso no es equivocarse: es que **el resultado invertido se lee como un hallazgo
interesante** —«mirá, con más pendientes va más rápido»— en vez de como un error de diseño de la
medición. Un resultado que sorprende compra credibilidad justo cuando debería gastarla.

Y cambia el fix, que es lo que lo hace caro: si bastara una pendiente para disparar el costo, el
arreglo era «no dejes ninguna abierta»; como cada una cuesta y la segunda cuesta más, el problema es
el **costo por pendiente**. Con la medición invertida no se habría arreglado nada.

**How to apply:** en toda serie de condiciones **ordenables**, tomá el control **antes y después**, y
si podés, **aleatorizá o alterná el orden** en vez de subir en escalera. Declará el valor de los dos
controles en la entrega: si difieren, lo que medís es la deriva, no la condición. Y descontá
explícitamente el arranque en frío — la primera condición de cualquier serie lo paga entero.

Emparenta con [[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] y con
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]]: acá el instrumento **absolvía** a las pendientes.
