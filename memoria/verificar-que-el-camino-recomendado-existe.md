---
name: verificar-que-el-camino-recomendado-existe
description: "Antes de decirle a alguien \"entrá a X y hacé Y\", abrir X y comprobar que Y está ahí"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T21:26:32.726Z
---

**Antes de repetirle a un humano una instrucción de navegación —propia o de otra sesión— abrir esa
pantalla y comprobar que el camino existe.** Cuesta un `Read`; mandarlo a un callejón cuesta su
tiempo y la confianza en lo que uno le dice.

**Caso raíz (2026-07-21, copiloto).** La sesión de backend recomendó al operador *"entrá a la app →
Apps → Google Drive → autorizá"*, y lo había verificado bien de su lado: el endpoint respondía y
hasta corrió el control con un servicio inventado. Antes de reenviárselo abrí `PantallaApps.tsx`:
**era un catálogo estático**. Ocho servicios hardcodeados, ningún botón, ninguna llamada. El backend
llevaba tiempo cableado y vivo; **lo que faltaba era el consumidor**, y nadie lo sabía porque cada
lado había verificado su mitad.

**Por qué se escapa.** Las dos verificaciones eran correctas y ninguna cubría la junta. El backend
probó que el endpoint entrega el link; el frontend probó que la pantalla renderiza. La pregunta que
nadie hacía —*¿alguien LLAMA a ese endpoint?*— no es de ninguno de los dos lados. Un endpoint sin
consumidor y una pantalla sin backend se ven perfectos por separado.

**El olfato que lo dispara:** cuando una recomendación cruza el límite entre dos sesiones/capas,
verificar el lado que no la escribió. También sirve al revés — al agregar un endpoint, preguntar
quién lo consume; si la respuesta es "nadie todavía", eso es deuda, no una feature.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] (cada mitad confirmaba lo suyo) y de
[[consultar-documed-siempre-antes-de-implementar]] (leer el archivo real antes de afirmar qué hay).
