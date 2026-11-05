# G9 — Aviso de privacidad y derechos del titular
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

**Propósito:** operar el copiloto del emprendedor (chat, integraciones, cobros, memoria de actividad).
**Categorías:** identificación (email), contenido de conversación, datos fiscales (CUIT), datos de las apps conectadas, pagos.
**Terceros:** G3/G8. **Retención:** G10.
**Derechos:** acceso, rectificación, supresión, portabilidad. **Mecanismo: autoservicio** — exportación `GET /cuenta/exportar` y supresión `DELETE /cuenta` (confirmación exacta), o por el operador (`POST /admin/tenants/{id}/borrar`). Se conservan, seudonimizados, los comprobantes fiscales emitidos, la auditoría de acciones del operador y los conteos de uso. El texto legal se versiona con el ratchet `LEGAL_VERSION`; este borrador no lo reemplaza.
**Contacto:** **[PENDIENTE operador]**.

**Pregunta cerrada con el dato (SEC-D10, medido 2026-11-05):** la consola del operador (`copiloto_consola`, SELECT-only) lee `copiloto_mensajes` de **todos** los tenants por diseño. ¿Es ese el alcance deseado y debe decirse en este aviso? Decide el operador.
