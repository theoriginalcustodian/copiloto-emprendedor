---
name: borrar-el-archivo-no-borra-su-contrato
description: Al matar un cliente HTTP muerto, sus TIPOS y sus CLASES DE ERROR sobreviven en otros archivos, conservan el nombre del dominio nuevo, y esperan en el barril a que alguien los importe de buena fe
metadata:
  type: project
---

**LEER antes de implementar un endpoint cuyo cliente viejo se borró** — y al borrar cualquier cliente
HTTP muerto.

El 2026-07-06 el copiloto heredó un cliente HTTP de la app clínica junto con el motor vendorizado. El
`8761d54` lo borró: `packages/core/src/api/clientes.ts`, entero, con su `crearCliente`, su
`ClienteDetalle` y su `/clientes/opciones`. Se declaró limpio.

**No lo estaba.** El 2026-07-22, al ir a implementar el alta de clientes (hito 7), quedaban:

| Residuo | Dónde | Qué decía |
|---|---|---|
| `DuplicadoProbableError` | `api/errors.ts` | su docstring: **el `409` de `POST /clientes`** — con `similitud`/`dni_duplicado`, `candidatos`, y forzable con `forzar:true` |
| `CrearClienteRequest` | `api/types.ts` | el body del alta: `fecha_nacimiento`, `dni`, `genero`, `forzar` |
| `Cliente` (clínico) | `api/types.ts` | `id: string`, `dni_parcial` — exportado del **mismo barril** que el `Cliente` nuevo |

Aquella limpieza apuntó **al archivo**. Estos vivían en otros dos.

## Por qué no era residuo inofensivo

El contrato de *este* producto define el mismo `409` del mismo endpoint con **otro significado**: el
documento ya es de otro cliente, y viene **el id del dueño** para llevar al usuario a su ficha. Sin
fusión y sin forzar.

Quien fuera a implementar ese `409` —o sea: yo, ese día— iba a encontrar en `@copiloto/core` una
clase **con el nombre exacto de lo que necesitaba**, importarla, y ramificar por `motivo`: un campo
que este backend nunca manda. **La rama "es un duplicado" no se habría ejecutado jamás.** Sin error,
sin test en rojo, con el compilador conforme y el editor autocompletando.

Los dos `Cliente` conviviendo son la misma trampa en frío: el export explícito tapa al del
`export *`, en silencio, y cuál gana depende de un detalle de módulos que nadie mira.

## La regla

1. **Al matar un cliente HTTP, grepear por los NOMBRES DEL DOMINIO, no por el path del archivo.**
   `Cliente`, `CrearClienteRequest`, `DuplicadoProbableError`, `*Options` — los tipos y las clases de
   error viven en archivos compartidos (`types.ts`, `errors.ts`) y sobreviven al módulo que los usaba.
2. **"Nadie lo importa" no alcanza como criterio para dejarlo.** Un tipo huérfano con el nombre
   correcto es *peor* que uno con nombre ajeno: el ajeno se descarta de un vistazo, el correcto se
   adopta. El daño no lo hace el código muerto — lo hace **el próximo que lo encuentre vivo**.
3. **Borrar dejando epitafio.** Donde estaban, un comentario que diga qué eran, por qué se fueron y
   dónde vive la forma buena. Sin eso, el próximo lo "restaura" creyendo que fue una poda descuidada.

## Por qué rinde

Es pariente de [[verificar-que-el-camino-recomendado-existe]] y de
[[instrumentos-que-confirman-en-vez-de-verificar]]: en los tres, **la señal que debería alertar es la
que tranquiliza**. Un import que resuelve, un tipo que compila y un nombre que coincide con el dominio
son, los tres, evidencia de que estás en el camino correcto — y ninguno de los tres lo verifica.

Y es hermano de [[rastro-del-intento-pisa-al-hecho]] en el mecanismo: un artefacto de otra época
sigue en pantalla afirmando algo que ya no es cierto, y quien lo lee no tiene cómo saber que es viejo.

Caso completo en el acuse de `coordinacion/.../addendum_...clientes-falta-el-alta-A-MANO-hito-7`,
commit `e8681f8`.
