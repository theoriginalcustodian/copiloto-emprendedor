---
name: formula-de-identidad-congelada-sin-validar-el-mecanismo-del-server
description: Congelé la fórmula uuid5 de las aristas de estado sin validarla contra cómo el server realmente deriva el edge_uuid — el goal era correcto, el mecanismo no, y la fórmula literal rompía la invalidación en silencio
metadata:
  type: project
---

**Una fórmula de identidad es un supuesto crítico: se spikea contra el mecanismo real del server, no se
asume.** En el `addendum_ontologia-tipos-congelados` (2026-07-22) congelé la identidad de las aristas de
ESTADO como `uuid5(group, "{tipo}|{source_key}|{target_key}|{LOG_EVENT_ID}")`. **Mal.** El server NO
acepta un `edge_uuid` propio: lo deriva de `uuid5(NS, "{group}|{src_uuid}|{edge_type}|{tgt_uuid}")` —
función de los **uuid de los NODOS + tipo**, **sin `LOG_EVENT_ID` adentro**. Verificado por backend
contra `Graphity/services/structured_transform.py:145-173`, `documed/graph_identity.py:45` y el spike
vivo Q5b.

**Por qué era peligroso:** el `PATCH /edge/{uuid}` de invalidación apuntaría a un uuid que el server
nunca persistió → no falla, devuelve vacío → la invalidación no ocurre → **dos precios vigentes a la vez**.
El bug exacto que la regla anti-resurrección quería evitar, reintroducido por "arreglarlo". Un error de
identidad no protesta: el 200 vacío se siente igual que el éxito ([[instrumentos-que-confirman-en-vez-de-verificar]]).

**El goal estaba bien; el mecanismo no.** *La identidad de una arista de estado tiene que incluir el
evento que la originó* es correcto (anti-resurrección). Pero como el `edge_uuid` es función de los nodos,
el `LOG_EVENT_ID` va en la **clave del NODO destino** vía un **nodo-evento intermedio** — no en la
fórmula de la arista (imposible). Patrón canónico de documed (regla 3.ter, `graph_mapping.py:79-86`, el
caso Dx activo→resuelto→activo): `Pac→EpisodioDx→Dx` en vez de `Pac→Dx`. En el copiloto: `Precio`
(`DE_CONCEPTO`→Concepto) e `Imputacion` (`AL_TRABAJO`→ref) como nodos-evento; el concepto/ref estable se
alcanza por el 2º salto y sigue dedup.

**La lección compuesta:** validé el artefacto (los tipos contra `uc_tables.json`) pero NO el **razonamiento
sobre el artefacto** (la fórmula de identidad contra el server) — [[no-codificar-la-esperanza-principio-raiz]]
aplicado a una micro-inferencia que se sentía empírica. Lo cazó backend **leyendo el código de los dos
lados**, no implementando mi fórmula — el gate que evita que un error de diseño se canonice en el grafo.
Cuando documed ya resolvió algo (identidad de grafo), su código es la fuente, no mi deducción
([[consultar-documed-siempre-antes-de-implementar]] · [[verificar-la-composicion-root-no-el-default]]).
