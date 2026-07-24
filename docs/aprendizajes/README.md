# Aprendizajes — la cola que sí se implementa

> **Fase F7.5 del [bucle canónico](../BUCLE-CANONICO.md).** Un aprendizaje redactado y no implementado
> no es un aprendizaje: es información.

Esta carpeta está **versionada a propósito**. La captura en vivo de un sprint es efímera y vive en la
carpeta de coordinación (ignorada por git); **la cola de trabajo no**. Si los pendientes vivieran en una
carpeta ignorada, un `clean` o una máquina nueva los evaporarían — el mismo saco perdido con mejor
nombre.

## Estructura

```
docs/aprendizajes/
├── README.md          ← esto
├── pendientes/        ← LA COLA. Vaciarla es el gate de F0 del sprint siguiente.
│   └── AAAA-MM-DD_<slug>.md
└── AAAA-MM-DD/        ← implementados, por FECHA DE IMPLEMENTACIÓN
    └── <slug>.md
```

**El estado es la ubicación.** Implementar un aprendizaje es `git mv` de `pendientes/` a la carpeta del
día. Igual que el buzón de coordinación: un tablero que hay que acordarse de actualizar se desincroniza
y miente; un `mv` no puede. Nunca se declara el estado — se observa con un `ls`.

## Qué entra acá (y qué no)

Sólo el **nivel 1** de la taxonomía de enganche (§11 del bucle): lo que necesita que alguien construya
algo que **bloquee** — un hook, un gate de CI, un test de regresión, un tipo que no compile, un script
que falle ruidoso.

| Nivel | Qué se hace | ¿Genera archivo acá? |
|---|---|---|
| 1 — Mecánico | Se construye en F7.5 | **Sí** |
| 2 — Contextual (prompt, convención) | Edición de minutos, **en el acto** | No |
| 3 — Documental (memoria del proyecto) | Escribirlo **es** implementarlo | No |

Meter los tres niveles vuelve la cola impagable y se abandona entera. Es corta por construcción.

## El gate

`pendientes/` **vacío** es precondición para abrir el sprint siguiente. Binario, bloquea. Si un
aprendizaje del sprint anterior sigue sin gancho, el sprint N+1 se construiría con el método que ya se
sabe que falla.

## Cuándo se trabaja esta cola

**Entre sprints, y antes de cualquier fix de la app.** No es preferencia, es causalidad: estos cambios
modifican *cómo se construye*. Detrás de los fixes de producto, el sprint siguiente vuelve a producir
los mismos aprendizajes.

## Formato

```markdown
---
sprint: <en qué sprint se aprendió>
nivel: 1
dueño: <rol>
---
# <qué se aprendió, una línea>

**Evidencia:** <path:línea | comando | cita del log>
**Qué falló:** <el mecanismo, no el síntoma>
**Gancho a construir:** <concreto>
**DoD binario:** <cómo se prueba que ENGANCHA, incluido el control negativo>
```

El **control negativo** en el DoD no es adorno: un gancho que nunca se probó contra el caso que debe
atrapar es indistinguible de uno ausente.
