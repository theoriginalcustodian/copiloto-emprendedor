---
name: medir-si-un-gate-dispara-antes-de-embarcarlo
description: Antes de embarcar un umbral, medí si algún dato del corpus real puede alcanzarlo — si no, es un gate inerte con cara de protección
metadata:
  type: feedback
---

Auditoría propuso reemplazar un control roto mío por «un documento que cubre >80% del padrón es
normativo». Sonaba bien y venía de quien había encontrado el defecto. **Lo medí antes de escribirlo** y
no separa nada:

```
techo de MENCIONES de una medición  : 29/54 (53%)
techo de MENCIONES de un descartado : 29/54 (53%)   <- empate literal
techo de VEREDICTOS de una medición : 22/54
techo de VEREDICTOS de un descartado: 12/54          <- las mediciones están ARRIBA
```

Un gate al 80% **nunca habría disparado**. Y la premisa también se caía: el documento que motivaba el
umbral «citaba 54 de 54» contadas a mano, pero medido contra el padrón cita **29**.

**Why:** un gate inerte es peor que ninguno, y por la misma razón que el control que reemplaza —
promete una garantía que no puede dar, y encima parece rigor. Peor aún: no hay forma de descubrirlo
después, porque un gate que nunca dispara y uno que funciona bien se ven **idénticos** en verde.

**How to apply:** un umbral nuevo se embarca con **dos números medidos sobre el corpus real**: el techo
de lo que debe pasar y el piso de lo que debe frenar. Si no hay brecha entre los dos, el umbral no
existe — buscá otra propiedad, no otro número. Y dejá el empate **impreso en el reporte**, marcado «no
es un gate», para que el próximo que proponga el mismo discriminante lo vea antes de escribirlo: un
callejón sin salida sin señalizar se recorre dos veces. Hermana de
[[un-umbral-calibrado-al-corpus-del-dia-envejece-con-el]] (ése envejece, éste nace muerto) y de
[[instrumento-que-no-mira-nunca-falla]].
