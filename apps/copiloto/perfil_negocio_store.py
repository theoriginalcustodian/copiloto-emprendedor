"""Perfil del negocio + "soul" del copiloto — UNA fila por tenant (capa CLIENTE, multi-tenant).

Qué es: los pocos datos que hacen que el copiloto hable del negocio del emprendedor y no de uno
genérico. Se inyecta al system prompt por turno (ver `perfil_negocio_prompt.bloque_de_contexto`).

Qué NO es: el perfil FISCAL. Razón social, CUIT, domicilio y condición IVA ya viven en `afip_perfil`
y no se duplican acá — una segunda copia de un dato que ya existe diverge, y encima obligaría al
usuario a cargarlo dos veces.

Aislamiento por tenant: filtro EXPLÍCITO por `cliente_id` en CADA query. Es la barrera efectiva — el
proceso usa el rol owner de `DATABASE_URL`, que BYPASSA la policy RLS (mismo criterio que
`mp_credential_store` y `afip_comprobante_store`).
"""
from __future__ import annotations

from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_perfil_negocio"

# Allowlists de los campos de opción. Viven acá (no en el módulo web) porque son parte del contrato de
# datos: el prompt las lee para traducirlas a lenguaje natural, y los tests las recorren enteras.
A_QUIEN = ("empresas", "consumidor_final", "ambos")
FORMALIDAD = ("formal", "cercano")
LARGO_RESPUESTA = ("breve", "detallado")

# Campo -> largo máximo. `que_vende` es el único de formato libre largo: es la descripción del negocio.
LIMITES = {"que_vende": 500, "nombre_comercial": 120, "horario_atencion": 120, "nombre_copiloto": 120}

CAMPOS = ("que_vende", "a_quien", "nombre_comercial", "horario_atencion",
          "formalidad", "largo_respuesta", "nombre_copiloto")

_DEFAULTS = {"que_vende": "", "a_quien": "ambos", "nombre_comercial": "", "horario_atencion": "",
             "formalidad": "cercano", "largo_respuesta": "breve", "nombre_copiloto": ""}


class PerfilNegocioStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def get(self) -> dict | None:
        """El perfil de ESTE tenant, o `None` si nunca configuró nada.

        `None` NO es un error: es el estado normal del primer día, y el endpoint lo devuelve como
        `{"perfil": null}` con 200 — nunca 404. Un 404 acá empujaría al cliente a tratar "todavía no
        lo llenó" como "algo salió mal".
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(CAMPOS)}, updated_at FROM {_TABLE} WHERE cliente_id=%s",
                (self._cid,))
            row = cur.fetchone()
        if not row:
            return None
        perfil = dict(zip(CAMPOS, row[:len(CAMPOS)]))
        perfil["actualizado_en"] = row[len(CAMPOS)]
        return perfil

    def upsert(self, cambios: dict) -> dict:
        """Actualización PARCIAL: sólo las claves presentes en `cambios` se tocan.

        Por qué parcial y no reemplazo total: la pantalla de Ajustes tiene dos secciones (negocio y
        personalidad) que se guardan por separado. Con reemplazo total, guardar una borraría la otra
        salvo que el cliente reenvíe siempre el objeto completo — y el día que se agregue un campo
        nuevo, un cliente viejo lo borraría sin querer al guardar.

        Para VACIAR un campo se manda `""` explícito; ausente significa "no lo toques".

        La fila se crea con los DEFAULTS del resto si todavía no existía, así que el primer POST
        parcial no deja columnas en NULL.
        """
        campos = [c for c in CAMPOS if c in cambios]
        if not campos:
            raise ValueError("no hay ningún campo para actualizar")
        fila = {**_DEFAULTS, **{c: cambios[c] for c in campos}}
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, {', '.join(CAMPOS)}) "
                f"VALUES (%s{', %s' * len(CAMPOS)}) "
                f"ON CONFLICT (cliente_id) DO UPDATE SET "
                + ", ".join(f"{c}=EXCLUDED.{c}" for c in campos)
                + ", updated_at=now()",
                (self._cid, *(fila[c] for c in CAMPOS)))
        return self.get() or {}
