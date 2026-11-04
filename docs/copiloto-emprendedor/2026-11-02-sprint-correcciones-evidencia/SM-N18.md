# SM-N18 — evidencia de device: Mi Día sin aviso de «conexión caída» de Instagram

- **Captura:** `SM-N18-mi-dia-sin-aviso-instagram.png` (frontend1, 2026-11-03 08:40, RF8T318RN9T, cuenta del operador, solo lectura, bundle `acdbff54`).
- **Instrumento:** dump `uiautomator` completo con `instagram|conexi|caíd|caid` → 0 coincidencias; control positivo: el mismo dump sí lee «Ahora», «Para hoy», «Por cobrar», «Escribile a Odobi».

## Qué acredita cada ficha (no se cruzan)
- **SM-N18 (backend, causa):** el filtro `toolkits_conectables` (`0046ded4`) con test de dos mitades en VPS acredita la CAUSA. Esta captura es la corroboración en pantalla, y la fila `instagram` de `48a9d75f` pasó `para_hoy` → `hecha` (re-medido read-only).
- **SM-N17 (UI, dueño frontend1):** mide lo mismo desde la pantalla; su marcado es de frontend1/planificación con esta misma captura. Marcar una por la otra es el error esperable.

## Qué NO prueba la captura, y quién lo cubre
La captura sola no distingue «el fix lo quitó» de «Composio hoy no lista un caído». Eso lo atribuye el canario
`test_N18_CANARIO_por_la_ruta_real_el_filtro_es_lo_que_apaga_el_aviso` (PR #1506): inyecta `instagram` `EXPIRED`
en la forma real de `list_connections` y pasa por `avanzar_tablero` (la ruta de serve.py) CON el filtro (no hay
tarjeta) y SIN él (la tarjeta aparece). VPS con Postgres efímero: `test_conexion_caida.py` 16 passed, 0 skipped.
