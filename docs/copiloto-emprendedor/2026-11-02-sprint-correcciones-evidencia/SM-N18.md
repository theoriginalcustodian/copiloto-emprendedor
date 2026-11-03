# SM-N18 — evidencia de device: Mi Día sin aviso de «conexión caída» de Instagram

- **Captura:** `SM-N18-mi-dia-sin-aviso-instagram.png` (frontend1, 2026-11-03 08:40, RF8T318RN9T, cuenta del operador, solo lectura, bundle `acdbff54`).
- **Instrumento:** dump `uiautomator` completo con `instagram|conexi|caíd|caid` → 0 coincidencias; control positivo: el mismo dump sí lee «Ahora», «Para hoy», «Por cobrar», «Escribile a Odobi».

## Qué acredita cada ficha (no se cruzan)
- **SM-N18 (backend, causa):** el filtro `toolkits_conectables` (`0046ded4`) con test de dos mitades en VPS acredita la CAUSA. Esta captura es la corroboración en pantalla, y la fila `instagram` de `48a9d75f` pasó `para_hoy` → `hecha` (re-medido read-only).
- **SM-N17 (UI, dueño frontend1):** mide lo mismo desde la pantalla; su marcado es de frontend1/planificación con esta misma captura. Marcar una por la otra es el error esperable.

## Qué NO prueba
Que hoy no aparezca el aviso no distingue «el fix lo quitó» de «Composio no lista hoy un toolkit caído»; eso lo sostiene el test de backend, no la captura.
