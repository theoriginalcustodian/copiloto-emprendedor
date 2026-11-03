# Receta: build de release Android (EAS) — medida 2026-11-02

Para SM-L1 / SM-I6 (medir arranque en frío en release; el dev-client contamina el tiempo).

- **Se puede sin el operador.** `EXPO_TOKEN` en el entorno, keystore remota ya configurada, cero gates de credenciales. Local inviable (sin Android SDK/Java).
- **Comando** (desde `apps/mobile`): `npx --yes eas-cli@latest build --platform android --profile release-medicion --non-interactive --no-wait`
- **Perfil** `release-medicion` (`apps/mobile/eas.json`): extends `preview`, apk, `EXPO_PUBLIC_API_BASE=https://copilotoemprendedor.duckdns.org` inlineada (`adapters/http.native.ts:6`).
- **Tiempo:** ~22 min (subida+fingerprint ~1 min, cola ~1 min, build ~21 min). Ref: build `87dce515-eb8e-49ca-af32-43f8b72c8d3a`, commit `fa87d95`.
- **Verificación de que es release real:** `unzip -l <apk> | grep index.android.bundle` → ~4 MB embebido (sin Metro).
- **Estado de consulta:** `eas build:view <id>` (línea `Status`).
- **Instalar REEMPLAZA el dev-client** (mismo `applicationId`): `adb install -r <apk>`. Reponer dev-client: build `development` de EAS. Disparador de instalación: frontend1 suelta Metro (cierre de SM-N22..N28) o el operador pide la medición. Rebuild primero si main se movió.
- El APK es desechable; el perfil versionado es el entregable.
