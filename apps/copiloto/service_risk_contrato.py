"""Universo de servicios con TOOL VIVA detrás (RIESGOPROMESAWEB, lado Python).

El backend se prohibió nombrar una capacidad sin tool viva (`system_prompt.py:28-32`, regla nacida
de que el prompt decía "ver contactos y redes" cuando HubSpot e Instagram ni existían como tool). La
web nunca heredó esa regla: `SERVICE_RISK` (`packages/core/src/chat/hitl.ts`) sigue teniendo una
entrada para `instagram`, que no tiene una sola tool real detrás.

Este archivo declara ese universo -- el set de `service` que puede llegar genuinamente en una card
(`card.service`, el mismo string que lee `mapearGate`) porque ALGUNA tool viva lo manda. El test de
paridad TS (`serviceRisk.contrato.paridad.test.ts`) exige que cada clave de `SERVICE_RISK` esté en
este set O declarada como excepción explícita (`instagram`, ver `service-risk-excepciones.json`).

Derivación (verificada contra el código real, no inventada -- `service_risk_contrato_test.py` la
re-deriva por regex para que esto no sea una aserción manual sin control):
  - Dinámicos (`services/*.py`, descubiertos por `services.modules()`): cada módulo declara
    `TOOLKIT = "<service>"` y ese valor viaja tal cual en `_obs_service(mod.TOOLKIT)`
    (`tool_catalog.py:1650`). Hoy: `docs.py->googledocs`, `drive.py->googledrive`, `gmail.py->gmail`,
    `sheets.py->googlesheets`. Instagram NO está ahí -- cero módulo, cero tool.
  - 1ra clase (fuera de `services/`, el string va literal a `_obs_service("<service>")`):
    `mercadopago` (`tool_catalog.py:626`, cobro MP) y `googlecalendar` (`tool_catalog.py:576`,
    agendar). Ambos pasan por el MISMO wiring de card de confirmación que los dinámicos -- por eso
    cuentan igual, aunque no vivan en `services/`.

Formato: una clave por línea, entre comillas dobles -- mismo patrón que `catalog_contrato.py`/
`auth_login_contrato.py`. No armar el set en tiempo de ejecución: el lector TS es un regex sobre el
texto de este archivo.
"""

SERVICIOS_CON_TOOL_VIVA = frozenset({
    "googledocs",
    "googledrive",
    "gmail",
    "googlesheets",
    "mercadopago",
    "googlecalendar",
})
