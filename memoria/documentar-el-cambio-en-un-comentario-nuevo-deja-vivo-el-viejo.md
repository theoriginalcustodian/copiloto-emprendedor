---
name: documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo
description: El proto explica por qué la grilla de 7 ya no sirve en :1505 mientras :796 sigue afirmando que son 7 y que no se agrupa — los dos comentarios coexisten, los dos son deliberados, y el que cita la referencia lee el que encuentra primero.
metadata:
  node_type: memory
  type: feedback
---

**Regla.** Cuando alguien cambia algo y **documenta el cambio en un comentario nuevo**, el comentario
viejo que ese cambio vuelve falso **queda en el archivo**. No hay descuido: las dos frases fueron
escritas a propósito, las dos suenan informadas, y **el lector se queda con la que encuentra primero**.
Es peor que un comentario stale suelto, porque el archivo contiene su propia refutación y eso da la
sensación de estar bien documentado.

**Medido el 2026-09-28** sobre `Prototipo frontend/odobi-ui/prototipo/index.html` (el artefacto que
este repo cita como **referencia** para juzgar la app), con denominador declarado: **348 comentarios →
134 con forma de afirmación verificable → 27 verificados uno por uno → 8 líneas contradichas por el
ejecutable, 19 consistentes.** Los 27 se eligieron por mayor señal, así que ese ~30 % es **techo de la
muestra, no tasa del archivo**; quedaron 107 candidatos sin abrir.

Los pares, que son el corazón del asunto:

| el comentario viejo afirma | el comentario NUEVO narra el cambio | el ejecutable |
|---|---|---|
| `:796-802` «**SIETE** opciones en grilla… **no se reordena ni se agrupa**» | `:1505-1511` «Ajustes en FILAS AGRUPADAS (20/08)… la grilla venía del repo, que hablaba de 7 opciones. **Con 10 dejó de servir**» | `:2115-2137`: **10 filas en 3 grupos** |
| `:1073-1117` Inteligencia con **dos solapas (Resumen · Preguntar)**, placeholder «Preguntá sobre tus números…», aviso de alcance | `:2151-2153` y `:3602-3604` hablan de «la duplicación que sacamos con la solapa Preguntar» — **en pasado** | `.solapas` existe en CSS (`:1081`) con **0 usos en markup**; `#inteligencia` (`:1939-2028`) es vista única; placeholder real `:2023` «Preguntame lo que quieras…» |
| `:3103-3106` «el descarte se mudó de Mi día al **TABLERO**» | `:3817-3818` «el descarte **VUELVE** a Mi día» | `:3819` `descartable()` sobre `#exp .ex` ⇒ Mi día |
| `:2802-2803` «las tres de Ayuda **todavía no tienen subpantalla dibujada**… quedan sin destino» | — | `:2144`, `:2159`, `:2191` son las tres `subp`, abiertas por el handler genérico `[data-ir]` de `:3784-3785` |

**Why:** documentar un cambio se siente como cerrar el ciclo, y el acto que falta es **borrar o marcar
lo que el cambio invalidó**. Nadie vuelve a leer el comentario viejo: está en otra parte del archivo, y
quien lo encuentra lo hace buscando el tema, no auditando. Cuando el artefacto es una **referencia**
—algo que otros citan para decidir— cada comentario viejo produce veredictos falsos en cadena, y el
error no se atribuye al artefacto sino a quien lo citó.

**How to apply.** Dos lados:
- **Al escribir:** si tu comentario nuevo explica por qué algo cambió, grepeá el tema y **matá o fechá
  la afirmación que acabás de volver falsa, en el mismo commit.** Si no la borrás, fechala («al 20/08
  eran 7»): una afirmación con fecha no se cita como estado vigente.
- **Al citar:** antes de usar un comentario de la referencia como evidencia, **grepeá si hay un
  comentario POSTERIOR sobre el mismo tema.** No alcanza leer el que apareció en la búsqueda. Si los
  dos existen, gana el ejecutable, y la contradicción es un hallazgo por sí misma.

Distinto de [[una-cifra-en-un-comentario-es-un-cache-sin-invalidacion]] (ahí la cifra es válida sólo
con su par y **migró de contexto**; el remedio es recomputar) y de
[[cambiar-el-alcance-deja-mintiendo-lo-que-otros-ya-escribieron]] (ahí un **acto puntual y datable**
invalida artefactos de otras sesiones; el remedio es barrer en ese momento). Acá las dos frases viven
en el **mismo archivo**, escritas por la misma mano, y ninguna de las dos se revisa.
Emparenta con [[el-guard-se-satisface-con-su-propio-comentario]] y con
[[el-nombre-es-una-hipotesis-sobre-el-contenido]].

**Evidencia:** `docs/copiloto-emprendedor/Auditorias/2026-09-28-el-proto-como-referencia-comentarios-que-se-contradicen-entre-si.md`.
