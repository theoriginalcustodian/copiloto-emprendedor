"""El ciclo de reparación: forjar → aplicar → auditar → probar, con REINTENTO informado.

## Por qué existe este módulo y no está todo en la activity

El objetivo del operador es **12/12**: cada corrida del ciclo termina con un parche aceptado por el
gate. La medición de S5 dio **11/12** con un solo intento — y el diferencial mostró que la que falló
no fue por falta de contexto sino por **variabilidad del modelo**, que `temperature=0` no elimina.

Contra variabilidad, un prompt más perfecto no alcanza: hay que **volver a tirar con información
nueva**. Ese es el trabajo de este módulo. Y lo hace en UN solo lugar para que el banco de medición
ejercite **exactamente** el mismo código que corre en producción — si el banco midiera una copia, su
12/12 no diría nada del sistema real.

## El reintento es informado, no una segunda tirada

El gate ya sabe **qué tests rompió** el parche. Devolvérselo al forjador (parche previo + motivo +
nodeids) es feedback **localizado**, que baja regresiones ~70%; la orden genérica *"falló, probá de
nuevo"* las **aumenta** ([[localizacion-estructurada-feedback-agentes]]).

## Todo entra por parámetro

`forjar`, `auditar` y `probar` se inyectan. No es ceremonia de testing: es lo que permite medir el
ciclo 12 veces contra el LLM real sin desplegar Temporal, y testear la lógica de reintento sin gastar
un centavo. El orden de los pasos (barato → caro) lo fija el workflow y se replica acá.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Protocol

#: Intentos totales del forjador (1 inicial + N-1 reintentos informados). Tres es el techo por costo:
#: cada intento son 2 llamadas al LLM (forja + auditoría) y una corrida de la suite. Si tres intentos
#: informados no alcanzan, el problema no es la tirada — es que el bug excede al forjador, y ahí el
#: ciclo tiene que rendirse y dejarle el trauma a un humano en vez de quemar cuota.
MAX_INTENTOS = 3


class Aplicable(Protocol):
    """Lo que devuelve `forjador_parches.aplicar_bloques` — nombres COPIADOS de esa dataclass, no
    inventados. (Se escribieron de memoria como `aplicado`/`motivo` y el banco de C0 reventó las 12
    corridas con `AttributeError`: inferir un nombre desde su significado es una hipótesis, no un
    contrato. El error fue barato porque el banco no lo disimuló — falló ruidoso 12 veces.)"""
    ok: bool
    contenido: str
    detalle: str


@dataclass(frozen=True)
class Intento:
    """Un paso del ciclo, con TODO lo necesario para entender por qué salió como salió."""
    numero: int
    texto_modelo: str
    aplicado: bool
    motivo: str
    aprobado_auditor: bool | None = None
    aceptado_gate: bool | None = None
    regresiones: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ResultadoCiclo:
    """El desenlace. `exitoso` es el criterio C0: hubo un parche que el gate ACEPTÓ."""
    exitoso: bool
    motivo: str
    contenido_final: str | None = None
    parche_final: str | None = None
    intentos: tuple[Intento, ...] = field(default_factory=tuple)

    @property
    def cantidad_intentos(self) -> int:
        return len(self.intentos)


def reparar(
    *,
    archivo: str,
    contenido: str,
    salida_pytest: str,
    no_romper: str,
    forjar: Callable[[str], str],
    aplicar: Callable[[str, str], Aplicable],
    auditar: Callable[[str, str], tuple[bool, str]],
    probar: Callable[[str], tuple[bool, str, tuple[str, ...]]],
    prompt_inicial: Callable[..., str],
    prompt_reintento: Callable[..., str],
    max_intentos: int = MAX_INTENTOS,
) -> ResultadoCiclo:
    """Corre el ciclo hasta que el gate acepte un parche o se agoten los intentos.

    Cada rechazo alimenta el siguiente intento. Los tres motivos de rechazo son distintos y se
    propagan distinto a propósito:

    - **no aplicable** (formato roto, fragmento inexistente o ambiguo) → el modelo no citó bien el
      archivo. El feedback es el motivo del aplicador, que ya es específico.
    - **rechazado por el auditor** → el parche toca lo que no debe. El feedback es el veredicto.
    - **rechazado por el gate de tests** → aplicó y rompió cosas. El feedback son **los nodeids**,
      que es el más accionable de los tres.

    Colapsarlos en "falló" perdería justamente la información que hace útil al reintento.
    """
    intentos: list[Intento] = []
    texto = ""
    motivo_previo = ""
    regresiones: tuple[str, ...] = ()

    for numero in range(1, max_intentos + 1):
        if numero == 1:
            prompt = prompt_inicial(archivo=archivo, contenido=contenido,
                                    salida_pytest=salida_pytest, no_romper=no_romper)
        else:
            prompt = prompt_reintento(archivo=archivo, contenido=contenido,
                                      salida_pytest=salida_pytest, no_romper=no_romper,
                                      intento_previo=texto, motivo_rechazo=motivo_previo,
                                      regresiones=regresiones)
        texto = forjar(prompt)
        aplicacion = aplicar(texto, contenido)

        if not aplicacion.ok:
            motivo_previo = f"el parche no se pudo aplicar: {aplicacion.detalle}"
            regresiones = ()
            intentos.append(Intento(numero, texto, False, motivo_previo))
            continue

        aprobado, motivo_auditor = auditar(texto, archivo)
        if not aprobado:
            motivo_previo = f"el auditor lo rechazó: {motivo_auditor}"
            regresiones = ()
            intentos.append(Intento(numero, texto, True, motivo_previo, aprobado_auditor=False))
            continue

        aceptado, motivo_gate, regresiones = probar(aplicacion.contenido)
        intentos.append(Intento(numero, texto, True, motivo_gate, aprobado_auditor=True,
                                aceptado_gate=aceptado, regresiones=regresiones))
        if aceptado:
            return ResultadoCiclo(True, f"aceptado en el intento {numero}",
                                  contenido_final=aplicacion.contenido, parche_final=texto,
                                  intentos=tuple(intentos))
        motivo_previo = motivo_gate

    return ResultadoCiclo(
        False,
        f"agotados los {max_intentos} intentos; último motivo: {motivo_previo}",
        intentos=tuple(intentos))
