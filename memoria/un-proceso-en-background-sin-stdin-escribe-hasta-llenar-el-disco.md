---
name: un-proceso-en-background-sin-stdin-escribe-hasta-llenar-el-disco
description: Un proceso lanzado en background cuyo stdin se agota no muere — reintenta y escribe su error para siempre; llenó 84 GB en 7 archivos y el síntoma apareció en TODAS las otras sesiones menos en la culpable
metadata:
  type: feedback
---

**2026-10-14. `python - <<EOF` lanzado con `run_in_background`: el heredoc termina, el stdin se
agota, y el REPL de Python **no sale** — vuelve a imprimir el prompt y el traceback, en bucle, a su
archivo de captura.** Siete archivos, de 2,9 a 20 GB: **84 GB** de un disco de 466. Se llenó a 0 bytes
libres.

**Lo que hace esto difícil de cazar no es el bucle: es dónde aparece el síntoma.** El proceso culpable
no falla nunca — escribir le sale bien. Fallan **los demás**: `cat > archivo` dejó un archivo en 0 bytes,
`cola-check.sh` abortó por no poder crear su temp, el GC de sidecars borró los 3 que vigilaba porque su
lista temporal volvió vacía, y `open(path,'w')` murió con `OSError 28`. Las tres sesiones vieron
`No space left on device`; **ninguna de las tres era la que escribía**.

**Mi falla de diagnóstico, que es la parte reutilizable:** medí consumidores de disco donde la intuición
dice que viven (npm-cache 16 G, papelera 20 G, cachés de navegador, pagefile) y llegué a ~60 GB de 466.
Escribí «**lo no medido es lo grande**» y escalé al operador con comandos de borrado y un pedido de
WizTree. Lo no medido era la **carpeta de sesión del agente**, el único lugar que descarté por
clasificarlo como temporal irrelevante. La pregunta que no hice: **«¿quién está escribiendo AHORA?»** —
sólo pregunté «¿quién ocupa?». Un disco que se llena en minutos tiene un escritor vivo; un disco lleno
por acumulación, no.

**Why:** el consumidor de un disco que se llena rápido es un proceso, no un caché. Buscar por tamaño
acumulado encuentra lo viejo y grande; el que te está matando puede ser nuevo y estar creciendo. Y como
su síntoma se manifiesta en terceros, cada sesión reporta «el disco está lleno» y ninguna se mira a sí
misma.

**How to apply:**
- Nunca `python` pelado ni heredoc en background: `python -I archivo.py </dev/null` con `timeout`.
  El `</dev/null` es lo que convierte el bucle en una salida inmediata.
- Ante `No space left on device`: antes de medir cachés, medir **crecimiento** — los archivos de captura
  de tareas de las carpetas de sesión, ordenados por tamaño, y dos veces con un minuto de diferencia.
  Si uno creció, ése es la causa y no hay nada que borrar del operador.
- No es sólo de otros: en la misma medición mi propia sesión tenía 7 capturas de 11 a 57 MB por el mismo
  mecanismo a 1/1000 de escala. El hábito que me salvó fue de grado, no de clase.
- Ningún instrumento de vigilancia mide el tamaño de su propio directorio temporal. Hasta que lo haga,
  este modo de fallo vuelve.

Relacionadas: [[heredoc-sin-quotar-ejecuta-el-prompt]] (el otro modo de fallar del heredoc) ·
[[open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo]] (el daño que el disco lleno
hace a los writes) · [[instrumento-que-no-mira-nunca-falla]] (el GC que falló abierto acá) ·
[[medir-si-un-gate-dispara-antes-de-embarcarlo]]
