"""El escalón que faltaba: pedir ayuda cuando el ciclo NO puede reparar.

Todo con dobles sobre `subprocess.run` — el punto es la LÓGICA (a quién se avisa, cuándo se
duplica, cómo degrada), no ejercitar `gh`. Lo que sí se ejercita de verdad es la forma exacta
de los comandos, porque un `gh issue list` mal armado devolvería vacío SIEMPRE y el resultado
sería un issue por ocurrencia: el instrumento que confirma en vez de verificar.
"""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

import autosanacion_activities as A

TRAUMA = {"id": 7, "fingerprint": "fp-abc123", "error_type": "ConnectionError",
          "costura": "activity_interceptor", "workflow": "CobroWorkflow", "dedupe_count": 4}


class _Gh:
    """Doble de `subprocess.run` que registra los comandos y responde por subcomando."""

    def __init__(self, issues_abiertos: str = "[]", crear_ok: bool = True) -> None:
        self.comandos: list[list[str]] = []
        self._issues = issues_abiertos
        self._crear_ok = crear_ok

    def __call__(self, cmd, **kw):
        self.comandos.append(cmd)
        if cmd[:3] == ["gh", "issue", "list"]:
            return subprocess.CompletedProcess(cmd, 0, stdout=self._issues, stderr="")
        if cmd[:3] == ["gh", "issue", "create"]:
            return subprocess.CompletedProcess(
                cmd, 0 if self._crear_ok else 1,
                stdout="https://github.com/x/y/issues/1\n" if self._crear_ok else "",
                stderr="" if self._crear_ok else "could not add label")
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")


def _con_canal(monkeypatch, gh: _Gh, tmp_path: Path) -> None:
    monkeypatch.setattr(A, "_repo_para_pr", lambda: tmp_path)
    monkeypatch.setattr(A, "_hay_gh", lambda: True)
    monkeypatch.setattr(A.subprocess, "run", gh)


def _abrir(trauma=TRAUMA, motivo="categoría 'infra_error': no hay código que reparar acá"):
    return asyncio.run(A.abrir_issue_de_trauma({"trauma": trauma, "motivo": motivo}))


def test_abre_el_issue_cuando_no_hay_ninguno(monkeypatch, tmp_path):
    gh = _Gh(issues_abiertos="[]")
    _con_canal(monkeypatch, gh, tmp_path)
    r = _abrir()
    assert r["abierto"] is True and r["modo"] == "issue"
    creado = [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]
    assert len(creado) == 1
    cuerpo = creado[0][creado[0].index("--body") + 1]
    assert "fp-abc123" in cuerpo, "sin el fingerprint en el cuerpo, la búsqueda de duplicados falla"
    assert "ConnectionError" in cuerpo and "CobroWorkflow" in cuerpo


def test_NO_duplica_si_ya_hay_uno_abierto_con_el_mismo_fingerprint(monkeypatch, tmp_path):
    """El mismo bug puede pegar mil veces. Un issue por ocurrencia inundaría el repo y entrenaría
    a ignorar la etiqueta — y ahí se pierde el aviso que importaba."""
    gh = _Gh(issues_abiertos='[{"number": 42}]')
    _con_canal(monkeypatch, gh, tmp_path)
    r = _abrir()
    assert r["abierto"] is False and r["modo"] == "ya_existe"
    assert not [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]


def test_CONTROL_la_busqueda_de_duplicados_usa_el_FINGERPRINT(monkeypatch, tmp_path):
    """El control que hace significativo al test de arriba.

    Si la búsqueda no llevara el fingerprint, `gh issue list` devolvería lo mismo para cualquier
    trauma: o nunca duplica (y se pierde el segundo bug) o siempre duplica. Las dos pasarían el
    test anterior según qué devuelva el doble — el veredicto vendría del mock, no del código.
    """
    gh = _Gh()
    _con_canal(monkeypatch, gh, tmp_path)
    _abrir()
    listado = next(c for c in gh.comandos if c[:3] == ["gh", "issue", "list"])
    assert "fp-abc123" in listado
    assert "--state" in listado and listado[listado.index("--state") + 1] == "open"


def test_sin_canal_degrada_y_NO_lanza(monkeypatch, tmp_path):
    """Perder el trauma porque no se pudo avisar sería el peor resultado: el aviso es un extra
    sobre la fila de la DLQ, no un reemplazo."""
    monkeypatch.setattr(A, "_repo_para_pr", lambda: None)
    assert _abrir()["modo"] == "sin_canal"

    monkeypatch.setattr(A, "_repo_para_pr", lambda: tmp_path)
    monkeypatch.setattr(A, "_hay_gh", lambda: False)
    assert _abrir()["modo"] == "sin_canal"


def test_un_trauma_SIN_fingerprint_no_abre_nada(monkeypatch, tmp_path):
    """Sin fingerprint no hay idempotencia posible: abriría un issue por cada corrida, para
    siempre. Mejor no avisar que inundar — el trauma sigue en la DLQ igual."""
    _con_canal(monkeypatch, _Gh(), tmp_path)
    assert _abrir(trauma={**TRAUMA, "fingerprint": None})["modo"] == "sin_canal"


def test_INVARIANTE_lo_unico_que_se_descarta_SIN_avisar_es_el_canario():
    """El invariante que cierra el agujero, y la lección de cómo se abrió.

    `necesita_humano` y `reintentable` se agregaron el mismo día, cada uno con su razón, y por
    separado los dos eran correctos:

      - "descartá lo permanente" (para que no tape la cola)
      - "no avises de lo que no es accionable" (para que el canal no sea ruido)

    Juntos producían el PEOR resultado posible en la intersección: un trauma sin `archivo:línea`
    se cerraba **y** nadie se enteraba nunca. Antes al menos quedaba `pendiente`. Lo destapó un
    E2E en el VPS, no la suite — porque ningún test miraba las dos banderas A LA VEZ.

    Este test mira el par. `descartado` significa "no vuelve nunca más", así que sale del sistema
    en silencio: la única excepción legítima es el canario, cuyo error es deliberado y cuyo valor
    ya quedó registrado en la fila. Cualquier otra combinación (`reintentable=False` +
    `necesita_humano=False`) es un error que desaparece sin que nadie lo sepa.
    """
    import autosanacion_gates as gates

    casos = [
        ("dominio prohibido", dict(ruta="afip_gateway.py", reparaciones_hoy=0,
                                   categoria="business_error")),
        ("sin categoría", dict(ruta="x.py", reparaciones_hoy=0, categoria=None)),
        ("infra_error", dict(ruta="x.py", reparaciones_hoy=0, categoria="infra_error")),
        ("kill switch OFF / normal", dict(ruta="x.py", reparaciones_hoy=0,
                                          categoria="business_error")),
    ]
    for nombre, kw in casos:
        d = gates.puede_reparar(**kw)
        if not d.permitido and not d.reintentable and not d.necesita_humano:
            assert gates.MARCA_CANARIO in kw["ruta"].lower(), (
                f"{nombre}: se descarta y NO avisa. El trauma sale del sistema en silencio — "
                f"sólo el canario puede hacer eso.")

    # Control positivo: la excepción TIENE que existir de verdad. Sin esto, un gate que devolviera
    # `necesita_humano=True` para todo pasaría el bucle de arriba sin ejercitar ni una vez la rama
    # que importa — el test se volvería un `assert True` con forma de invariante.
    canario = gates.puede_reparar(ruta="POST /salud/canario", reparaciones_hoy=0,
                                  categoria="business_error")
    assert not canario.permitido and not canario.reintentable and not canario.necesita_humano


def test_INVARIANTE_un_trauma_SIN_ORIGEN_tambien_avisa(monkeypatch):
    """La otra mitad del invariante: este rechazo vive en la ACTIVITY, no en el gate.

    Es el caso exacto que abrió el agujero — se rechaza ANTES de mirar la categoría, así que un
    `manual_intervention` sin `archivo:línea` ni siquiera llegaba a `puede_reparar`. Sin archivo
    igual hay `error_type`, `workflow`, `costura` y `dedupe_count`: un error que pegó 9 veces es
    accionable aunque no sepamos la línea.
    """
    d = asyncio.run(A.evaluar_gates_de_reparacion(
        {"id": 1, "fingerprint": "fp", "error_type": "ConnectionError",
         "workflow": "CobroWorkflow", "contexto": {}}))
    assert d["permitido"] is False and d["reintentable"] is False, "debería descartarse"
    assert d["necesita_humano"] is True, "se descarta sin avisar: desaparece en silencio"


def test_si_la_ETIQUETA_no_existe_igual_abre_el_issue(monkeypatch, tmp_path):
    """Perder el aviso por una label que nadie creó en el repo sería absurdo: se reintenta sin ella."""
    gh = _Gh(crear_ok=False)
    _con_canal(monkeypatch, gh, tmp_path)
    _abrir()
    creados = [c for c in gh.comandos if c[:3] == ["gh", "issue", "create"]]
    assert len(creados) == 2, "tiene que reintentar sin --label"
    assert "--label" in creados[0] and "--label" not in creados[1]
