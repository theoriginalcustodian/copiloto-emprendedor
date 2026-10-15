---
name: pasada-device-fe2-trampas-env-gate-y-registro
description: Cinco trampas de una pasada de device + registro de mediciones (frontend2, 2026-10-15) que cuestan una vuelta cada una
metadata:
  type: feedback
---

Cinco cosas que se pagaron en una sola pasada (2026-10-15). Ninguna se deduce del código.

1. **Metro desde un worktree no trae `.env`** → sin `EXPO_PUBLIC_API_BASE=https://copilotoemprendedor.duckdns.org` el login da «No pudimos conectarnos», que parece error de red o de credencial. **Why:** el `.env` no se versiona. **How to apply:** exportarla al arrancar Metro y verificar el bundle por un identificador del cambio (ver [[metro-en-modo-ci-no-observa-archivos-el-device-corre-el-primer-build]]).
2. **`#<dígitos>` en un comentario rompe `temaSinHex`** (lo lee como color `#227`). **How to apply:** correr el gate mobile COMPLETO (`src/theme/temaSinHex` incluido) antes de pushear, no sólo el subset del archivo tocado.
3. **`sorted()` sobre un JSON versionado reordena todo el diff** (±1000 líneas por +3 entradas). **How to apply:** insertar sin reordenar y mirar `git diff --stat` antes de commitear.
4. **Un `cierre_` en el buzón NO mueve el contador hasta registrarlo**: `contar-veredictos.py` sólo cuenta los basenames de `MEDICIONES_DECLARADAS` (un doc sin clasificar corta el instrumento) y un id con COHERENTE web + DESVÍO mobile dispara conflicto aunque sean dos superficies → entrada en `CONFLICTOS_CONOCIDOS`. **How to apply:** el cierre y su registro viajan juntos; el delta se mide con `falta-en-mobile.py` desde un worktree en `origin/main`, nunca desde el checkout compartido (rancio). Medido: mobile 16→42 de 54 con un solo cierre registrado. Ver [[un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit]].
5. **El harness de login (`evidencia_device.py --frente login`) APENDEA** a lo que ya haya en los campos (mail y contraseña quedan duplicados). **How to apply:** vaciar los dos campos (tocar, `keyevent 123`, ~90 × `keyevent 67`) y verificar con captura ANTES de correrlo; `uiautomator dump` no sirve en pantallas animadas («could not get idle state»): deep link + `screencap`.
