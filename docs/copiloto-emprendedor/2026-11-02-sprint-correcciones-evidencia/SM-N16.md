# SM-N16 — evidencia de device: avatar visible y toque que navega

**Medido:** 2026-11-02 20:54–20:56 · teléfono RF8T318RN9T · app `app.copiloto.emprendedor` (dev-client) con Metro local desde `main` + #1425 (el avatar es el de #1401, ya en `main`).
**Usuario:** cuenta del **operador** (razón social visible en Ajustes; no versionada, recortada). NO es el canónico `e2e-device@copiloto.test`.

## Qué se midió
1. **El avatar se ve.** Mi día, esquina superior derecha: círculo con anillo naranja y la inicial `S` (`avatar-cuenta` `[608,109][690,191]`, `avatar-cuenta-inicial` = `S`). Antes decía «círculo invisible, sin iniciales».
   → `SM-N16-1-avatar-visible-antes-del-toque.webp` (recorte de la franja del avatar).
2. **El toque navega.** `adb input motionevent` DOWN→MOVE→UP sobre (649,150) → pantalla **Ajustes** con la cuadrícula (Tu negocio / La app / Ayuda). Región del avatar comparada antes/después (no la captura entera): suma de diferencias por canal 329 346 → cambió.
   → `SM-N16-2-tras-el-toque-Ajustes.webp` (recorte del título; la razón social queda fuera).
3. «‹ Volver» regresa a Mi día; sesión sin tocar, card de factura del operador sin tocar.

## Qué NO acredita (queda en `Falta:`)
- **DoD 4 (canónico hasta cerrar sesión):** requiere la cuenta **canónica** puesta; con la del operador no se llega a «Cerrar sesión» sin cerrar su sesión. Tenencia necesaria: sesión canónica en el teléfono.
- **DoD 6 (causa del no-responde de las 19:05):** hoy 20:56 **navegó** con la cuenta del operador, mismo gesto. No se reprodujo; la causa del 19:05 queda sin atribuir (puerta de `empujarUnaVez`, bundle viejo o estado). No hay evidencia para afirmar cuál.
