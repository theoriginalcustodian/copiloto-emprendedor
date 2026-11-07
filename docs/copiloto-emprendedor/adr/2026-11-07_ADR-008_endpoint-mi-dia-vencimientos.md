# ADR-008 — `GET /mi-dia/vencimientos`: los vencimientos fiscales de Odobi en Mi día

- **Fecha:** 2026-11-07
- **Estado:** ACCEPTED (test adversarial cross-tenant presente: `tests/test_mi_dia_vencimientos.py::test_ADVERSARIAL_A_no_ve_los_vencimientos_de_B` + `tests/test_adversarial_frontdoor_por_ruta.py::test_adversarial_mi_dia_vencimientos_get`)
- **Ficha:** SM-P20 punto 2
- **Contexto:** «Vencen esta semana» necesitaba los CAE por vencer y el certificado AFIP. El contrato asumía que el dato no existía; existe: `afip_comprobantes.cae_vto` (vía `AfipComprobanteStore.con_cae_vigente()`) y `vence_at` de las credenciales (`AfipCredentialStore.vencimientos()`). `leerAgenda` (Calendar) no es el lugar: es otra fuente con otra auth.

## Decisión

Endpoint nuevo de solo lectura, tenant-scoped por `require_tenant` (el `cliente_id` sale del token, nunca del request).

```
GET /mi-dia/vencimientos?dias=<int>      # default DIAS_VENTANA_DEFAULT, 0 ≤ dias ≤ MAX_DIAS_AGENDA; fuera de rango → 422
200 {"vencimientos": [
  {"tipo": "cae" | "certificado", "id": str, "titulo": str,
   "fecha": "YYYY-MM-DD" | null, "dias": int | null, "vencido": bool}
]}
```

- Incluye lo **ya vencido** (`vencido: true`, `dias` negativo) y lo que vence dentro de la ventana.
- Una fecha ilegible no se descarta: va con `fecha/dias = null` (que se vea, no que desaparezca).
- Orden: vencidos primero, después por `dias` ascendente; los `null` al final.
- Lógica pura en `apps/copiloto/mi_dia_vencimientos.py::armar`; wiring en `serve.py` (`make_listar_vencimientos`).

## Opciones descartadas

- **Meter los vencimientos en `/mi-dia/tablero` como tarjetas**: mezcla un dato derivado (se recalcula) con tarjetas persistidas que el usuario mueve de estado; duplicaría la verdad.
- **Agregarlos a la respuesta de la agenda**: acopla Calendar (Composio) con AFIP; si Composio cae, desaparecen los vencimientos.

## Consecuencias / rollback

Aditivo: ningún cliente existente cambia. Rollback = revertir el merge; sin migraciones.
