"""Clasificador de tickets de soporte (BETA-4a) — resuelve `origen` desde texto libre vía graphity-code.

**Por qué existe:** BETA-0 (PR#230) probó que el forjador NO puede actuar sobre un síntoma no-técnico
sin `origen` — necesita el corte ANTES de tickear. Este módulo hace ese corte. Ver la trifecta
(`docs/copiloto-emprendedor/Manejo de errores/08-TRIFECTA-agente-soporte-BETA4a.md`) y el `contrato_`
BETA-4a-agente-soporte-v1 (Decisión 1/§2.1).

## El umbral de confianza — spike chico corrido en esta sesión (2026-08-04), no adivinado

`POST /graph/search` (scope=nodes) **no devuelve score/confianza** — el shape real es
`{"edges":[...], "nodes":[{name, attributes:{source_file, source_location}, ...}], ...}`, sin ningún
campo numérico (verificado contra el server real, `graphitymt.duckdns.org`). Se probaron 3 queries
reales contra `group_id=code-copiloto-emprendedor`:

1. Query = el símbolo literal (`"_run_registrar_presupuesto"`) → top-1 exacto, `tool_catalog.py:L799`.
2. Query = la queja del usuario, tal cual la escribiría (sin vocabulario técnico) → resultados
   NO relacionados (`.me()`, tests de `presupuesto()`).
3. Query = una versión MÁS naturalista pero con vocabulario de dominio ("registrar presupuesto",
   "contacto") → **tampoco** encontró `_run_registrar_presupuesto` — la búsqueda semántica devolvió
   funciones de OTRO layer (frontend TS/mobile) con el mismo vocabulario superficial.

**Conclusión empírica:** la búsqueda semántica sola NO es señal de confianza suficiente — ni siquiera
con vocabulario de dominio. La única señal barata y determinista que separó limpiamente el caso 1 del
2/3 fue la **mención literal del símbolo o archivo** en el texto. Por eso el umbral es estricto por
diseño (Decisión 1 del contrato: "sin match claro, `origen=None`, NO intentar adivinar" — BETA-0 ya
mostró que adivinar sin confianza produce ruido, no señal). Consecuencia esperada y aceptada: la
mayoría del feedback en lenguaje natural de un usuario NO va a resolver `origen` — cae a
`necesita_humano=True`, que es el comportamiento seguro por default (Decisión 2).

## Qué NO hace este módulo

No llama a ningún LLM (cero costo, cero superficie de PII hacia un tercero por esta vía — el único
tráfico de red es hacia el propio graphity-code, ya usado por otras piezas del repo para memoria/grafo
de negocio). No decide el destino final del ticket (eso es `soporte_feedback_activities.py`); esto
sólo resuelve `origen | None`.

## El `source_file` de graphity-code NO es la ruta real del repo (verificado, no supuesto)

El grafo se pobló con `source_dirs` como `apps/copiloto`, `packages/core`, `motor` (HANDOFF del grafo
de código), y `source_file` viene relativo al **padre** de cada `source_dir` — `"copiloto/x.py"` para
algo bajo `apps/copiloto`, `"core/x.ts"` para `packages/core`, pero `"motor/x.py"` tal cual para
`motor` (sin padre propio dentro del repo). Confirmado contra el checkout real: `copiloto/tool_catalog.py`
NO existe, `apps/copiloto/tool_catalog.py` SÍ. Usar `source_file` a ciegas como `origen.archivo`
apuntaría al forjador a una ruta inexistente (o, peor, a una que exista por coincidencia). Por eso
`resolver_origen` prueba los prefijos conocidos CONTRA EL DISCO y sólo acepta el candidato cuyo
archivo reconstruido existe de verdad — un match sin archivo real detrás es tan "sin confianza" como
un match semántico débil, y se descarta igual (`origen=None`).
"""
from __future__ import annotations

import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Callable

import httpx

#: Prefijos que graphity-code omite, en el orden de `source_dirs` del HANDOFF del grafo de código.
#: `""` primero (motor/scripts/spikes/deploy no tienen padre propio dentro del repo).
_PREFIJOS_SOURCE_DIRS = ("", "apps/", "packages/")

_READ_TIMEOUT_S = 10.0
#: Símbolos/archivos más cortos que esto no cuentan como match — evita falsos positivos tipo "me"/"ok".
_LARGO_MINIMO_MATCH = 6


class GraphityCodeError(RuntimeError):
    """Falla no recuperable consultando graphity-code (status inesperado tras agotar reintentos)."""


def _normalizar(texto: str) -> str:
    """minúsculas, sin acentos, `_`/`.`/`()` fuera — para comparar símbolo vs texto libre a prueba de
    ruido de formato, no de significado (no es NLP, es comparación de tokens)."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", texto.lower()) if not unicodedata.combining(c))
    return re.sub(r"[_.\(\)\-/]+", " ", sin_acentos)


def _symbol_bare(nombre: str) -> str:
    """`"_run_registrar_presupuesto()"` → `"_run_registrar_presupuesto"`; `".cambiar_estado()"` →
    `"cambiar_estado"`. El grafo antepone `.` a métodos de instancia (ver HANDOFF del grafo de código)."""
    return nombre.strip().lstrip(".").rstrip("()")


def _archivo_bare(source_file: str) -> str:
    """`"copiloto/tool_catalog.py"` → `"tool_catalog"` — nombre de archivo sin ruta ni extensión."""
    base = source_file.rsplit("/", 1)[-1]
    return base.rsplit(".", 1)[0] if "." in base else base


class SoporteClasificador:
    """Cliente mínimo de `POST /graph/search` contra el grafo de CÓDIGO (no confundir con los otros 3
    clientes Graphity del repo — memoria conversacional / grafo de negocio: `graphity.md`). Tenant y
    credenciales PROPIOS del grafo de código (`GRAPHITY_CODE_*`), nunca los de memoria/negocio."""

    def __init__(self, *, base_url: str, api_key: str, group_id: str,
                 client: httpx.Client | None = None, max_attempts: int = 3,
                 sleep: Callable[[float], None] | None = None, raiz_repo: Path | None = None) -> None:
        self._base = base_url.rstrip("/") + "/api/v2"
        self._headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
        self._group_id = group_id
        self._client = client or httpx.Client(timeout=_READ_TIMEOUT_S)
        self._max_attempts = max_attempts
        self._sleep = sleep or (lambda s: None)
        # Mismo cálculo que `autosanacion_activities.set_autosanacion_deps`: desde
        # `apps/copiloto/soporte_clasificador.py`, `parents[2]` es la raíz del repo.
        self._raiz_repo = raiz_repo or Path(__file__).resolve().parents[2]

    @classmethod
    def from_env(cls) -> "SoporteClasificador":
        base = os.environ.get("GRAPHITY_CODE_BASE_URL")
        key = os.environ.get("GRAPHITY_CODE_API_KEY")
        group_id = os.environ.get("GRAPHITY_CODE_GROUP_ID", "code-copiloto-emprendedor")
        if not base or not key:
            raise RuntimeError(
                "faltan GRAPHITY_CODE_BASE_URL / GRAPHITY_CODE_API_KEY (grafo de CÓDIGO, distinto del "
                "de memoria/negocio) en el env del copiloto")
        return cls(base_url=base, api_key=key, group_id=group_id)

    def _archivo_real(self, source_file: str) -> str | None:
        """El path repo-relativo real, o `None` si ningún prefijo conocido reconstruye un archivo que
        exista de verdad (ver el docstring del módulo — `source_file` de graphity-code NO es la ruta
        real)."""
        for prefijo in _PREFIJOS_SOURCE_DIRS:
            candidato = f"{prefijo}{source_file}"
            if (self._raiz_repo / candidato).is_file():
                return candidato
        return None

    def _buscar_nodos(self, query: str, *, limit: int = 5) -> list[dict[str, Any]]:
        body = {"query": query, "group_ids": [self._group_id], "scope": "nodes",
                "node_labels": ["Function", "File"], "limit": limit}
        last_exc: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                resp = self._client.post(self._base + "/graph/search", headers=self._headers, json=body)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc  # se relanza fuera del loop (GraphityCodeError) si se agotan los intentos
                if attempt == self._max_attempts - 1:
                    break
                self._sleep(2 ** attempt)
                continue
            if resp.status_code in (429, 502, 503, 504) and attempt < self._max_attempts - 1:
                self._sleep(2 ** attempt)
                continue
            if resp.status_code != 200:
                raise GraphityCodeError(f"POST /graph/search: {resp.status_code} {resp.text[:300]}")
            return resp.json().get("nodes") or []
        raise GraphityCodeError(f"POST /graph/search: agotados {self._max_attempts} intentos") from last_exc

    def resolver_origen(self, texto: str) -> dict[str, Any] | None:
        """`{"archivo", "linea", "funcion"}` si el texto libre menciona LITERALMENTE un símbolo/archivo
        que graphity-code devuelve para esa query — `None` si no hay match confiable, o si el servicio
        de grafo falla (fail-safe: un clasificador caído nunca degrada a "reparar a ciegas", degrada a
        `necesita_humano`, igual que un match ambiguo)."""
        try:
            candidatos = self._buscar_nodos(texto)
        except GraphityCodeError:
            return None  # grafo caído: fail-safe a necesita_humano, no a "reparar a ciegas"

        texto_norm = _normalizar(texto)
        for nodo in candidatos:
            attrs = nodo.get("attributes") or {}
            source_file = attrs.get("source_file")
            source_location = attrs.get("source_location")
            if not source_file or not source_location:
                continue
            bare = _symbol_bare(nodo.get("name", ""))
            archivo_bare = _archivo_bare(source_file)
            match = ((len(bare) >= _LARGO_MINIMO_MATCH and _normalizar(bare) in texto_norm)
                     or (len(archivo_bare) >= _LARGO_MINIMO_MATCH and _normalizar(archivo_bare) in texto_norm))
            if not match:
                continue
            archivo_real = self._archivo_real(source_file)
            if archivo_real is None:
                # Símbolo mencionado, pero ningún prefijo conocido reconstruye un archivo que exista
                # de verdad — mismo criterio que un match ambiguo: no adivinar, seguir buscando.
                continue
            try:
                linea = int(re.sub(r"\D", "", source_location) or 0)
            except ValueError:
                linea = 0  # source_location con forma inesperada: degrada a línea 0, no rompe el match
            return {"archivo": archivo_real, "linea": linea, "funcion": bare}
        return None


def respuesta_para_necesita_humano(texto_original: str) -> str:
    """Mensaje honesto para el usuario cuando el ticket queda `necesita_humano=True` (Decisión 2 del
    contrato: nunca "ya lo arreglé" — el copiloto no hace lo que no hizo)."""
    return ("Gracias por avisarme. Todavía no puedo resolver esto automáticamente, así que lo derivé "
            "para que el equipo lo revise a mano — no fue descartado.")
