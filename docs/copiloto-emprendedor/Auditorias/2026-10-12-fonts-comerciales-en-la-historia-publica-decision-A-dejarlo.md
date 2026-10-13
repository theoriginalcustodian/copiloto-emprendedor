# Fuentes comerciales en la historia del repo público — decisión A: dejarlo

**Fecha:** 2026-10-12 · **Decidido por:** el operador · **Id de backlog:** `BL-X6`
**Veredicto:** se deja, documentado. No hay acción pendiente.

## Qué se midió

| medición | valor |
|---|---|
| blobs `.otf` únicos en la historia alcanzable | **10** |
| peso total | **0,7 MB** |
| commits que agregaron `.otf` | 32 (el alta: `b7fae2e2`, 2026-09-21) |
| `.otf` en el árbol de trabajo | **0** |
| `.otf` alcanzables desde `origin/main` hoy | **0** |
| `refs/pull/*` que el remoto sirve | **1006** |

Los diez archivos:

```
Prototipo frontend/odobi-ui/assets/fonts/NeueEinstellung-Bold.otf
docs/Imagen de marca/Neue_Einstellung/Hanken Design Co - Neue Einstellung {Black,Bold,Extra Bold,
  Extra Light,Light,Medium,Regular,Semi Bold,Thin}.otf
```

Son cortes de **Neue Einstellung**, de **Hanken Design Co.** — una familia comercial.

## Por qué esto NO es un hallazgo de secretos, y por qué igual se registra

La auditoría del 2026-08-06 barrió **toda** la historia buscando credenciales y cerró con **0
secretos**, con control positivo en cada pasada. Ese resultado **sigue en pie**: una fuente
tipográfica no es una credencial. No hay nada que rotar, ningún acceso que revocar, ningún
movimiento lateral posible.

Lo que sí hay es **contenido de terceros redistribuido en un repo público**, que es un riesgo de
**licencia**, no de seguridad. Se registra acá porque si no, la frase «0 secretos en toda la
historia» se lee como «no hay nada que mirar en la historia» — y son dos preguntas distintas con
dos barridos distintos. **La auditoría de secretos no busca licencias, y nunca dijo que lo hiciera.**

## Por qué la opción A, con el contrapunto que se le dio al operador

Las tres opciones se presentaron medidas. El argumento decisivo contra reescribir la historia:

🔴 **`git filter-repo` NO cierra el agujero por sí solo.** GitHub sigue sirviendo los blobs por
`refs/pull/<n>/head` — hay **1006** de esos refs en este remoto — y esas refs no se van reescribiendo
la historia: hay que pedirle un **GC a GitHub Support**. Sin ese paso, se paga el costo entero de la
reescritura por una mitigación **parcial**.

Y el costo de la reescritura es **cierto**, no hipotético:

- invalida **todos** los SHAs citados en docs y ADRs — y este repo cita procedencia por SHA en todas
  partes (`medido @ <sha>`), así que la reescritura convierte cada cita en un puntero muerto;
- los **51 worktrees activos** quedan apuntando a una historia que ya no existe.

## Lo que queda abierto, nombrado en vez de tapado

El riesgo de licencia **no se midió**: no se leyó la licencia de Neue Einstellung. Hanken Design Co.
publica cortes gratuitos y cortes de pago, así que **no se sabe** si esta redistribución está
permitida. La opción B del card era exactamente leerla primero; el operador eligió A.

⇒ **Disparador para reabrir:** si el repo deja de ser para «amigos cercanos» y pasa a producción
pública con marca, leer la licencia **antes**, no después. **Dueño del disparador:** el operador.

🤖 planificación
