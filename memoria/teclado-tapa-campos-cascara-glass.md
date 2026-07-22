---
name: teclado-tapa-campos-cascara-glass
description: "En la cáscara glass el teclado se dibuja ENCIMA sin achicar la ventana: tapa los campos Y deja el ScrollView sin desborde, así que tampoco se puede scrollear hasta ellos"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T18:38:35.211Z
---

**LEER antes de poner un formulario dentro de un `transparentModal` de pantalla completa.**

**Un solo bug, dos síntomas que parecen dos.** En este device (SM-A217M, Android 12) el teclado
**no redimensiona la ventana**: se dibuja encima. Consecuencia en cadena — el contenedor no se
achica → el `ScrollView` nunca desborda → **deja de ser scrolleable**. El operador lo reportó como
dos problemas (*"el teclado tapó la pantalla"* + *"no se puede scrollear para ver los campos"*) y era
el mismo. Arreglar sólo el scroll no habría cambiado nada.

**Las dos mitades del arreglo — con una sola, el síntoma no se mueve:**

1. `MarcoGlass` → `<KeyboardAvoidingView behavior="padding">` en **ambas** plataformas (no el
   `ios:padding / android:height` de manual: `height` asume una ventana que sí achicó). Va en el
   **marco**, no en cada pantalla: toda función con formulario lo hereda.
2. `ScrollFormulario` → revela el campo que recibe el foco. React Native **no** scrollea solo hasta
   el input enfocado. Mide con `measureInWindow` (coordenadas de ventana, no `onLayout` relativo al
   padre) tras `setTimeout(120)` — sin la demora se mide contra la altura vieja y el scroll queda
   corto: el campo sigue tapado **y encima ya se movió**.

**Lo canónico está en documed** (`ChatView.tsx:207`, `login.tsx:73-141`), medido en ESTE teléfono.
No se deduce: se lee y se porta.

**How to apply:**
1. `collapsable={false}` en toda `View` cuyo ref se vaya a medir — Android la colapsa fuera del árbol
   nativo y `measureInWindow` **nunca llama a su callback**: el revelado sería un no-op silencioso.
2. El `style` que llega de afuera es del **`ScrollView`**, no del contenedor que lo envuelve. Pasarlo
   al contenedor deja al scroll sin altura acotada y **rompe el scroll por completo** — pasó acá, y
   los 277 tests siguieron en verde: en jsdom no hay altura que acotar.
3. Todo campo de contraseña lleva **ojo**. Una clave larga con símbolos tipeada a ciegas convierte un
   error de tipeo en algo indistinguible de una función rota.
4. Verificar **en device**, siempre: los cuatro defectos de esta tanda pasaron el gate de jsdom.

[[gate-jsdom-no-ve-gestos-tactiles]] · [[consultar-documed-siempre-antes-de-implementar]] ·
[[rastro-del-intento-pisa-al-hecho]]
