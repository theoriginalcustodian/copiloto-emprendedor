"""Converge los bloques de Caddy que gestiona el deploy del Copiloto (paso [6/7] de deploy.sh y caddy-sync.sh).

CONVERGENTE, no sólo idempotente: cada bloque gestionado se REEMPLAZA si su contenido difiere del deseado.
Antes, `if host in content: no-op` (deploy.sh:478) hacía que una directiva nueva jamás llegara a prod: el
deploy imprimía «ya existe» y no tocaba nada. Pregunta que lo caza: ¿si cambio el valor, cambia el recurso?

Uso: python3 caddy_converge.py BASE_DOMAIN COPILOTO_SUB MP_SUB WEB_PORT PUBLIC_HOST AUTH_PORT [CADDYFILE]
- PUBLIC_HOST: el dominio público del front-door (`copilotoemprendedor.duckdns.org`). Sus /auth/v1/{authorize,
  callback,verify} van al GoTrue dedicado (AUTH_PORT); el resto, al API (WEB_PORT).
- Valida con `caddy validate` ANTES de aplicar; si no valida, aborta sin tocar el Caddyfile.
"""
import re
import shutil
import subprocess
import sys

RUTAS_AUTH = ("/auth/v1/authorize*", "/auth/v1/callback*", "/auth/v1/verify*")


def bloque_texto(host, cuerpo):
    """Texto de un bloque de sitio, SIN salto final (la comparación es exacta)."""
    return f"{host} {{\n" + "\n".join(cuerpo) + "\n}"


def cuerpo_copiloto(web_port):
    return [f"    reverse_proxy 127.0.0.1:{web_port}"]


def cuerpo_publico(auth_port, web_port):
    # `log` = logging de Caddy a journal (sin cambio de respuestas). Es la directiva que prueba que el
    # deploy CONVERGE: agregarla al deseado debe reflejarse en el Caddy vivo (DEPLOYNOCONVERGE, DEPLOYLAG).
    cuerpo = ["    log"]
    for ruta in RUTAS_AUTH:
        cuerpo += [f"    handle {ruta} {{", f"        reverse_proxy 127.0.0.1:{auth_port}", "    }"]
    cuerpo += ["    handle {", f"        reverse_proxy 127.0.0.1:{web_port}", "    }"]
    return cuerpo


def aplicar_bloque(content, host, cuerpo):
    """Devuelve (contenido, acción). Acción: '+' agregado · '~' reemplazado · '=' ya igual."""
    deseado = bloque_texto(host, cuerpo)
    # Ancla en columna 0 (`^`): un host que aparece como SUBSTRING de otro bloque
    # (voz-web.copilotoemprendedor.duckdns.org) no debe confundirse con el bloque top-level.
    patron = re.compile(r"^" + re.escape(host) + r" \{\n.*?^\}$", re.MULTILINE | re.DOTALL)
    m = patron.search(content)
    if m is None:
        return content.rstrip("\n") + "\n\n" + deseado + "\n", "+"
    if m.group(0) == deseado:
        return content, "="
    return content[: m.start()] + deseado + content[m.end():], "~"


def aplicar_rewrite_callback(content, mp_host):
    """`rewrite /callback /mp/callback` dentro del bloque mp.*: se agrega si falta (sin reemplazar el resto)."""
    patron = re.compile(r"(" + re.escape(mp_host) + r"\s*\{)(.*?)(\n\})", re.DOTALL)
    m = patron.search(content)
    if m is None:
        raise ValueError(f"no encontré el bloque {mp_host}")
    if "rewrite /callback /mp/callback" in m.group(2):
        return content, "="
    nuevo = m.group(1) + "\n    rewrite /callback /mp/callback" + m.group(2) + m.group(3)
    return content[: m.start()] + nuevo + content[m.end():], "+"


def converger(content, base_domain, copiloto_sub, mp_sub, web_port, public_host, auth_port):
    """Función pura: devuelve (contenido_nuevo, [(host, acción), ...]). Sin tocar disco."""
    copiloto_host = f"{copiloto_sub}.{base_domain}"
    mp_host = f"{mp_sub}.{base_domain}"
    acciones = []
    content, a = aplicar_bloque(content, copiloto_host, cuerpo_copiloto(web_port))
    acciones.append((copiloto_host, a))
    content, a = aplicar_bloque(content, public_host, cuerpo_publico(auth_port, web_port))
    acciones.append((public_host, a))
    content, a = aplicar_rewrite_callback(content, mp_host)
    acciones.append((f"{mp_host} rewrite", a))
    return content, acciones


def main(argv):
    base_domain, copiloto_sub, mp_sub, web_port, public_host, auth_port = argv[1:7]
    path = argv[7] if len(argv) > 7 else "/etc/caddy/Caddyfile"
    with open(path, encoding="utf-8") as f:
        original = f.read()
    try:
        nuevo, acciones = converger(original, base_domain, copiloto_sub, mp_sub, web_port, public_host, auth_port)
    except ValueError as e:
        print(f"ERROR: {e} en {path}", file=sys.stderr)
        return 1
    for host, accion in acciones:
        print(f"{accion} {host}")
    if nuevo == original:
        print("Caddyfile sin cambios (ya convergido) -- sin escribir")
        return 0
    tmp = path + ".new"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(nuevo)
    # El temporal nace con el umask de root: copiamos el modo del original para no dejar el Caddyfile
    # ilegible para Caddy (memoria copiloto-dominio-duckdns: "queda 600 si se mueve un mktemp").
    shutil.copymode(path, tmp)
    result = subprocess.run(["caddy", "validate", "--config", tmp], capture_output=True, text=True)
    if result.returncode != 0:
        print("CADDY VALIDATE FALLO -- abortando SIN aplicar (Caddyfile original intacto)", file=sys.stderr)
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return 1
    shutil.copy(path, path + ".bak")
    shutil.move(tmp, path)
    print("Caddyfile actualizado + validado OK (backup en Caddyfile.bak)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
