---
name: receta-avion-reverse-connect-destraba-dev-launcher
description: "Receta para reconectar el dev-client de Expo cuando cae en el ANR/bug upstream de la pantalla 'Development Servers': modo avión + adb reverse + Connect normal, sin deep-link ni rebuild. Verificada en device real 2026-07-23."
metadata:
  type: reference
---

**El ANR del dev-launcher al tocar "Connect" (o cualquier interacción con "Development Servers") se
esquiva sin deep-link ni rebuild.** Causa raíz: un fetch de cuenta EAS por la red del teléfono que
cuelga el hilo de UI ~10s hasta el ANR — confirmado por V-EXT contra el changelog crudo de
`expo-dev-launcher` (`Unpublished`, fixes sin publicar en ninguna versión, incluida discovery/auto-launch).

## La receta, en orden, verificada en device real

1. `adb shell cmd connectivity airplane-mode enable` (o el toggle físico) — corta la red del teléfono.
   El fetch de cuenta que colgaba ahora falla rápido en vez de trabarse.
2. `adb reverse tcp:8081 tcp:8081` — **sigue vivo en modo avión**, porque es un túnel por USB, no por
   la red del teléfono. El Metro del lado del server queda alcanzable igual.
3. `adb shell am force-stop <package>` + relanzar la activity principal.
4. Tapear el campo URL, escribir `http://localhost:8081`, tocar **Connect** (normal, sin deep-link).
   El bundle carga limpio — sin la pantalla de servidores bugueada de por medio.
5. `adb shell cmd connectivity airplane-mode disable` — restaurar la red. **La conexión ya establecida
   sobrevive**: no revierte al dev-launcher ni crashea al recuperar la red.

## Por qué rinde

El punto ciego no era "el Connect no funciona": era que el fetch de cuenta se disparaba ANTES o en
paralelo, y con red viva siempre ganaba la carrera hacia el ANR. Cortar la red saca esa carrera de la
ecuación sin tocar el mecanismo que sí necesitábamos (el túnel USB).

## Cuándo aplica

Cualquier dev-client Expo que muestre el mismo síntoma (ANR/crash al tocar "Development Servers" o
"Connect", con o sin el sheet "Log in or create an account..."). No aplica si el Connect ya funciona
sin red de por medio — ahí el problema es otro.

[[copiloto-mobile-first-cascara-glass]]
