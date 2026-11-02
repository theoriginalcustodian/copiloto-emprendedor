# SM-I2 — Dock de entrada: campo + mic chico al pie

Device físico, usuario canónico, dev-client contra Metro del worktree de la rama, 2026-11-02. Los gestos se
ejercieron con `adb input motionevent`, no con un dedo.

| Captura | Qué acredita |
|---|---|
| `SM-I2-1-mi-dia-reposo.webp` | Mi día con campo y mic chico al pie, sobre la tira «Escribile a Odobi» |
| `SM-I2-2-mi-dia-sostenido.webp` | Sostenido: la barra reemplaza al campo a ancho completo, con reloj, «Deslizá para cancelar», onda y candado |
| `SM-I2-3-chat-solta-para-cancelar-solo-dock.webp` | Chat: deslizado, «Soltá para cancelar». Recortada a la franja del dock |
| `SM-I2-4-chat-fijado-solo-dock.webp` | Chat: fijado, con eliminar, onda, reloj, pausa y enviar. Recortada a la franja del dock |
| `SM-I2-5-gastos-reposo.webp` | Gastos: dock al pie, y arriba quedan la foto y la píldora «Anotar un gasto» |
| `SM-I2-6-gastos-solta-para-cancelar.webp` | Gastos: la barra ocupa el ancho y «Anotar un gasto» no se deforma, que era el defecto de N8 |
| `SM-I2-7-gastos-escrito-se-carga-a-mano.webp` | Texto escrito en el dock: formulario prellenado y rótulo «Lo cargaste a mano» |
| `SM-I2-8-soporte-reposo.webp` | Soporte: sin el botón de voz grande, con foto, campo y mic chico |
| `SM-I2-9-soporte-solta-para-cancelar.webp` | Soporte: deslizado, «Soltá para cancelar» |

Las capturas del chat están recortadas porque arriba quedó un transcript de voz real captada del ambiente.

## Recorrido hecho en device

- **Mi día:** soltar sube el chat y manda el audio una sola vez, con burbuja «Por voz». El campo no abre teclado:
  sube el chat.
- **Chat:** deslizar y soltar descarta sin burbuja nueva. Fijar y Eliminar descartan. Con teclado, el dock sube y
  el avión reemplaza al mic.
- **Gastos:** deslizar y soltar descarta. El texto escrito abre el formulario, y salí con Cancelar sin guardar.
- **Soporte:** deslizar y soltar descarta sin mensaje nuevo.

## El cancelar deslizando

El backlog lo dejaba `[UNVERIFIED]` porque `adb` no lo había reproducido. **Era el instrumento:** la traslación
del Pan cuenta desde que el gesto activa, no desde el DOWN. Con 157 px no cruza los 70 dp de `UMBRAL_CANCELAR_PX`,
y con unos 250 px (10 `MOVE` de 25 px) sí. Quedó ejercido en chat, Gastos y Soporte. **No se midió con un dedo
real**, así que SM-L2 sigue teniendo qué comprobar.

## Decisiones

- **Glifo de micrófono del mapa en vez del isotipo.** Revierte ODOBI8 §A a favor del mapa.
- **El campo de Mi día no abre teclado, sube el chat.** Cuesta un toque extra antes de escribir.
- **Lo dictado en Mi día se envía directo por el chat**, sin pasar por un borrador.
- **Lo escrito en Gastos aprovecha la propuesta del agente pero se guarda como `manual`.** Antes de este arreglo
  se habría guardado como `voz`.

## Lo que NO queda hecho

- Ingresos, Presupuestos y Clientes siguen con `MicFuncion` hasta SM-J1.
- La web queda fuera de alcance.
