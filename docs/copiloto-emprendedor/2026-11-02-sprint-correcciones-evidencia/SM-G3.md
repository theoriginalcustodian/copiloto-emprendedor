# SM-G3 — teléfono liberado: logueado con el canónico

- **Device:** RF8T318RN9T · 2026-11-02 · «Mi cuenta» → «Con qué entrás a Odobi: `e2e-device@copiloto.test`»
  ([captura](SM-G3-mi-cuenta-usuario-canonico.webp)).
- **Descartable borrado** (`structuralsource@gmail.com`, tenant `522ac5df-…`): GoTrue `DELETE /auth/v1/admin/users/a273765a-…` → 200;
  `uc_factory.tenants` 1 fila borrada, restante 0; `find_user_by_email` → `None`. Antes: el descartable sólo tenía esa fila
  (0 filas en las otras 81 tablas con `cliente_id`).
- **Login del canónico** verificado además contra GoTrue con `deploy/copiloto/restaurar-contrasena-e2e.py` (dry-run): «el login con la canónica ya funciona».
