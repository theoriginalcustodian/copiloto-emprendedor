---
name: cero-que-no-se-puede-afirmar
description: Cuando el sistema no tiene cómo atar un dato, devolver 0 afirma un hecho falso con forma de dato — «no lo puedo saber» tiene que sobrevivir hasta el píxel
metadata:
  type: project
---

**LEER antes de devolver un total, un contador o un agregado que dependa de un vínculo que puede no
existir.**

## El caso

`consultar_cliente` responde *«¿cuánto me compró la panadería?»*. Dos fuentes, atadas distinto:

- **presupuestos** → por `cliente_ref` (lo llena el backfill)
- **facturas** → por `(doc_tipo, doc_nro)`, porque `afip_comprobantes` no tiene `cliente_ref` y no se
  lo agrega (tabla viva, §5 del contrato: no se refactoriza)

Un cliente que entró a la cartera **por nombre** —de un presupuesto, sin CUIT— **no tiene con qué
atarse a una factura**. La query devuelve 0 filas. Y `0` es la respuesta natural.

`0` ahí es **mentira**: lo cierto no es «no te compró nada», es «no lo puedo saber».

La solución fue un campo explícito, `facturas_atribuibles: false`, y una instrucción literal al LLM:
*«NO digas que no compró — decí que falta el documento y ofrecé cargarlo»*.

## Por qué rinde

**Un cero no se ve como un error.** Un `null`, una excepción o una lista vacía disparan sospecha; un
número redondo se lee como un hecho medido. El emprendedor mira «$0 facturado» y concluye que ese
cliente no le compró — y no tiene ninguna forma de descubrir que el sistema simplemente no podía
saberlo. La respuesta falsa es **indistinguible** de la verdadera y **no genera ningún síntoma**.

Es [[vacio-no-es-hallazgo-correr-el-control]] cruzando la frontera del producto: aquella regla vigila
lo que **yo** concluyo de un vacío; ésta, lo que el **usuario** concluye de un vacío que le
serví ya convertido en número. La primera protege el diagnóstico; la segunda, la decisión de alguien
que no puede auditarme.

Prima de [[rastro-del-intento-pisa-al-hecho]]: **un dato que no existe y un dato que vale cero se ven
igual, y sólo uno de los dos es cierto.**

## Cómo aplicarlo

1. Antes de devolver un agregado, preguntá: **¿existe un caso donde el vínculo no exista?** Si sí,
   `0` y «no aplica» son dos respuestas distintas y necesitan dos representaciones distintas.
2. **El flag viaja en los datos, no en un comentario.** `facturas_atribuibles`, `parcial`,
   `sin_vinculo` — un booleano explícito que el consumidor no puede ignorar por accidente.
3. **La distinción tiene que sobrevivir hasta el píxel.** Si se pierde en la capa de presentación, no
   sirvió de nada: el cartelito dice «0» igual. Cuando el consumidor es un LLM, decíselo **en
   imperativo** («NO digas que no compró»): describir el flag no alcanza, lo va a redactar como cero.
4. Si el consumidor es una pantalla, el estado correcto es un guion, un «—» o un «falta el CUIT para
   saberlo», nunca un número.
