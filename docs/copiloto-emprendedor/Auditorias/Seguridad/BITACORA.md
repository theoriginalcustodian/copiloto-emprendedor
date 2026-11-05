# BITACORA — auditoría de hardening

| fecha | frente | modelo | prompt sha256 | repo sha | exit | seg | salida |
|---|---|---|---|---|---|---|---|

## Cambios aplicados en producción (VPS unreal-copilot)
| fecha | id | cambio | verificación | rollback |
|---|---|---|---|---|
| 2026-11-04 | SEC-A1-2 | `/etc/ssh/sshd_config.d/00-hardening.conf` (sin password, X11 off, MaxAuthTries 3) — `deploy/hardening/sshd-00-hardening.conf` | llave entra en sesión nueva; password → `Permission denied (publickey)` | `rm` del drop-in + `systemctl reload ssh` |
| 2026-11-04 | SEC-A1-1 | `ufw` activo (deny in; 22/80/443 + 10.0.0.0/16, 10.10.0.0/16, 172.16.0.0/12) + `uc-fw-docker-user.service` (DROP 3000/55444 desde eth0) | desde afuera: 3000/8090/55444 cerrados, 443/22 abiertos; HTTPS 200; GoTrue 200; workers activos, 0 errores | `ufw --force disable` + `systemctl disable --now uc-fw-docker-user` |
| 2026-11-04 | SEC-C2-1, SEC-C3-1 | Caddy: cabeceras de seguridad + `/docs` `/redoc` `/openapi.json` → 404, generado desde `deploy/copiloto/caddy_converge.py` y aplicado con `caddy-sync.sh` | curl externo: 6 cabeceras presentes, `Server` removido, rutas 404, `/health` 200, authorize 302; 21/21 tests de `test_caddy_converge.py` | `cp /etc/caddy/Caddyfile.bak.aud-20261104 /etc/caddy/Caddyfile && systemctl reload caddy` |
| 2026-11-04 | SEC-B1-1 | `apt upgrade` (125 pkgs) + reboot del VPS: kernel 6.8.0-52 → 6.8.0-147 | post-boot: units web/worker/soporte/caddy/docker/fail2ban/ufw activas, GoTrue y Temporal healthy, HTTPS 200, authorize 302, 3000/8090/55444 cerrados, `reboot-required` ausente, 0 pendientes | no aplica (kernel anterior sigue en GRUB) |
| 2026-11-04 | SEC-A5-1 | GitHub: Dependabot alerts + security updates ENABLED (`gh api PUT vulnerability-alerts / automated-security-fixes`) | `security_and_analysis.dependabot_security_updates=enabled` | `gh api -X DELETE repos/<R>/vulnerability-alerts` |
| 2026-11-04 | SEC-B1-2 | Venv prod `/opt/uc-copiloto-venv`: anyio 4.14.2, certifi 2026.10.18, urllib3 2.8.0, brotli 1.2.1, PyJWT 2.15.0, cryptography 50.0.0 (`requirements.txt` igual). Gate previo en venv paralelo: 2951 passed / 0 failed. | smoke prod 43/43 BETA-READY (`evidencia/2026-11-04/smoke-post-bump.txt`) · durabilidad VERDE tras restart real del worker (`deps/durab-verificar.txt`) · `pip check` limpio | `pip install -r /root/aud-prod-venv-freeze-pre-bump-20261104.txt` + `systemctl restart uc-copiloto-web uc-copiloto-worker uc-copiloto-worker-soporte` |
