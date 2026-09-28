---
name: un-control-positivo-con-esperado-falso-acusa-al-script
description: Cuando un control positivo falla, la salida barata es ajustar el valor esperado hasta que aparezca el verde, y eso convierte el control en una tautología; el esperado también puede estar mal
metadata:
  type: feedback
---

# 🎯🔧 Un control positivo con ESPERADO FALSO acusa al script — y la salida barata lo vuelve tautología

Un control positivo tiene **dos** partes que pueden estar mal: el instrumento y el **valor esperado**.
Cuando el control falla, el reflejo es «el script está roto» y el arreglo barato es **mover el esperado
hasta que pase**. Ahí el control deja de medir: confirma lo que ya se creía.

**Por qué importa más que un bug normal:** un control ajustado a su propio resultado **se ve igual que
uno que funciona** — verde, reproducible, con evidencia. Es la misma familia que
[[el-guard-que-caza-a-su-propio-autor]] y [[instrumento-que-no-mira-nunca-falla]], con la diferencia de
que acá el que se corrompe es el **criterio**, no el sensor.

## El caso (2026-09-28)

Auditoría horneó **mi** afirmación —«`mic-funcion` se monta en 8 pantallas»— como control positivo de
`scripts/evidencia/anclas-ambiguas.py`. El script abortó en la primera corrida: daba **4**.

**No tocó el umbral.** Fue a ver cuál de los dos estaba mal, y era mi esperado:

- `Bubble.tsx:18` y `MicButton.tsx:12` **nombran `MicFuncion` en un comentario**, con cero `<MicFuncion`.
- `ChatScreen.tsx` y `FotoFuncion.tsx` aparecen en el grep y tampoco lo montan.
- Montajes JSX reales: `ClientesScreen` · `GastosScreen` · `IngresosScreen` · `PresupuestosScreen` = **4**.

Mi 8 era [[contar-un-simbolo-no-dice-en-que-rol-aparece]] otra vez, y estaba **en un contrato**, donde
otra sesión iba a usarlo para decidir un arreglo. Un ancla falsa en un contrato es peor que ninguna.

## La regla

Cuando un control positivo falla, **antes de tocar el script preguntá de dónde salió el número
esperado**: ¿lo midió alguien, o lo escribió alguien? Un esperado que viene de una afirmación en prosa
—un contrato, un doc, un mensaje— es **tan hipótesis como el código**. Si el esperado lo puso una
autoridad (el que dirige, el contrato, el ADR), la presión social empuja a ajustar el script: ese es
justo el momento de mirar el esperado primero.

Corolario para quien escribe los contratos: **poné el `path:línea` del que mediste, no el número
suelto.** Un número sin ancla no se puede refutar sin rehacer el trabajo.
