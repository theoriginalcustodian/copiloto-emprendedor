#!/usr/bin/env python3
"""Banco de medición de C0 — ¿12 de 12 corridas del ciclo terminan con parche aceptado?

## Qué mide y qué NO

Mide el **ciclo completo** (`ciclo_autosanacion.reparar`) contra el LLM **real**, sobre un bug
**real**: `fingerprint.py` sin el `& 0xFFFFFFFF`, el mismo caso de S5 donde el forjador de un solo
intento dio **11/12**. No mide una demo armada para salir bien.

Ejercita EXACTAMENTE el código de producción — el mismo `reparar()`, el mismo `aplicar_bloques`, el
mismo `prompt_de_forja`. Si el banco midiera una copia, su 12/12 no diría nada del sistema real.

## Los controles que trae horneados

1. **Control del bug**: antes de pedirle nada al modelo, corre la suite con el bug y **exige que
   falle**. Si el bug no rompe nada, el 12/12 sería trivial —cualquier parche "pasa"— y el banco
   estaría confirmando en vez de midiendo. Aborta con exit 2.
2. **Control del arreglo**: el veredicto de cada corrida NO es el exit code del proceso ni que el
   parche "aplicó": es que la suite **quede verde** corriendo de verdad.
3. **Diferencial de intentos**: reporta en qué intento acertó cada corrida. Un 12/12 logrado siempre
   al 3er intento es un dato distinto de uno logrado al 1º, y el promedio lo escondería.

## Uso

    OPENAI_API_KEY=... python scripts/medir_c0_autosanacion.py [--corridas 12]

Exit 0 sólo si TODAS las corridas terminaron aceptadas. Cualquier otra cosa es exit 1 con el detalle
de cuál falló y por qué — no se redondea a "casi".
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import tempfile
import tokenize
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "apps" / "copiloto"))

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

from ciclo_autosanacion import reparar  # noqa: E402
from forjador_parches import aplicar_bloques, prompt_de_forja, prompt_de_reintento  # noqa: E402
from sandbox_tests import nodeids_fallados, parsear_resumen  # noqa: E402

#: El bug real de S5: quitar la máscara de 32 bits del fingerprint.
ORIGINAL, ROTO = "& 0xFFFFFFFF", ""
ARCHIVO = "fingerprint.py"
TEST = "test_fingerprint.py"
NO_ROMPER = ("la firma pública de fingerprint_de_error(...) y que dos errores distintos sigan dando "
             "fingerprints distintos")


@dataclass(frozen=True)
class Caso:
    """Un bug **real** inyectado en un archivo **real**, con su suite.

    No son bugs de juguete: cada uno imita una clase de fallo que este backend puede tener de verdad,
    y todos rompen tests que ya existían. El `por_que` no es documentación: es el criterio por el que
    el caso está en la lista, y si alguien no puede escribirlo, el caso no entra.
    """
    nombre: str
    archivo: str
    test: str
    original: str
    roto: str
    no_romper: str
    por_que: str


#: Los casos del banco. Ninguno toca dominios prohibidos (el ciclo los rechazaría antes de forjar,
#: y estaríamos midiendo el gate en vez del forjador).
CASOS = (
    Caso("mascara-32-bits", "fingerprint.py", "test_fingerprint.py",
         "& 0xFFFFFFFF", "",
         "la firma pública de fingerprint_de_error(...) y que dos errores distintos sigan dando "
         "fingerprints distintos",
         "aritmética que se desborda en silencio — el hash deja de ser estable entre corridas"),
    # OJO con el marcador: la primera versión decía `[:200]`, que en `fingerprint.py` existe **sólo
    # dentro de un docstring** (el código usa `[:_LARGO_MENSAJE]`). La mutación cambiaba prosa, el
    # módulo quedaba sano, y el banco reportaba "el bug no rompe la suite" — verdad literal que
    # apuntaba al lugar equivocado. Por eso `_armar_caja` ahora exige que el marcador esté en CÓDIGO.
    Caso("truncado-del-mensaje", "fingerprint.py", "test_fingerprint.py",
         "[:_LARGO_MENSAJE]", "",
         "que el fingerprint siga siendo estable y que dos errores distintos den valores distintos",
         "un límite que alguien quita 'porque no hacía falta': mensajes largos parten el grupo de "
         "deduplicación y la DLQ se llena de entradas que son el mismo error"),
    Caso("herencia-del-mro", "taxonomia_errores.py", "test_taxonomia_errores.py",
         "for tipo in type(exc).__mro__:", "for tipo in [type(exc)]:",
         "que una subclase siga heredando la categoría de su padre",
         "el caso clásico de 'esto se puede simplificar': sin recorrer el MRO, un HTTPError(OSError) "
         "deja de ser infra_error y nunca más se reintenta solo"),
)


#: El caso por defecto: el de S5, con el que se midió el 12/12.
CASO_DEFAULT = CASOS[0]


def _correr_pytest(caja: Path, python: str, test: str = TEST) -> tuple[int, str]:
    p = subprocess.run([python, "-m", "pytest", test, "-q", "-ra"],
                       cwd=str(caja), capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def _marcador_en_codigo(fuente: str, marcador: str) -> bool:
    """¿El marcador aparece en CÓDIGO, o sólo dentro de un docstring/comentario?

    Existe por un fallo medido (2026-07-31): el caso `truncado-del-mensaje` usaba `[:200]`, que en
    `fingerprint.py` vive únicamente en un docstring — el código real dice `[:_LARGO_MENSAJE]`. La
    mutación cambiaba prosa, el módulo quedaba **sano**, y el banco reportaba *"el bug no rompe la
    suite"*. Literalmente cierto y engañoso: ese mensaje también es el que sale cuando la suite tiene
    un hueco real, así que dos causas opuestas —banco roto vs. suite ciega— se veían igual y pedían
    arreglos distintos. Acá se separan, en el punto donde la causa todavía se puede nombrar.
    """
    #: Se tapan strings y comentarios con espacios y se busca en lo que queda. Tapar en vez de
    #: borrar mantiene las posiciones, así que el resultado no depende del orden de los tokens.
    lineas = fuente.splitlines(keepends=True)
    tapado = [list(l) for l in lineas]
    for tok in tokenize.generate_tokens(io.StringIO(fuente).readline):
        if tok.type not in (tokenize.STRING, tokenize.COMMENT):
            continue
        (fila_ini, col_ini), (fila_fin, col_fin) = tok.start, tok.end
        for fila in range(fila_ini, fila_fin + 1):
            desde = col_ini if fila == fila_ini else 0
            hasta = col_fin if fila == fila_fin else len(tapado[fila - 1])
            for col in range(desde, min(hasta, len(tapado[fila - 1]))):
                if tapado[fila - 1][col] != "\n":
                    tapado[fila - 1][col] = " "
    return marcador in "".join("".join(l) for l in tapado)


def _armar_caja(caja: Path, caso: "Caso" = None) -> str:
    """Deja en `caja` el módulo ROTO y su suite. Devuelve el contenido roto.

    Si el fragmento a romper no está en el archivo, ABORTA en vez de seguir: un banco que mide sobre
    un archivo sano diría 12/12 sin haber reparado nada — el instrumento que confirma en vez de
    verificar.
    """
    caso = caso or CASO_DEFAULT
    fuente = (REPO / "apps/copiloto" / caso.archivo).read_text(encoding="utf-8")
    roto = fuente.replace(caso.original, caso.roto)
    if roto == fuente:
        raise SystemExit(f"[banco] ❌ no se pudo introducir el bug de '{caso.nombre}': "
                         f"{caso.original!r} no está en {caso.archivo}")
    if not _marcador_en_codigo(fuente, caso.original):
        raise SystemExit(
            f"[banco] ❌ el bug de '{caso.nombre}' NO toca código: {caso.original!r} sólo aparece en "
            f"docstrings o comentarios de {caso.archivo}. El módulo quedaría sano y el banco diría "
            f"'el bug no rompe la suite', que es el mismo mensaje que da una suite con un hueco "
            f"real. Corregí el marcador para que apunte al código.")
    (caja / caso.archivo).write_text(roto, encoding="utf-8")
    (caja / caso.test).write_text(
        (REPO / "apps/copiloto/tests" / caso.test).read_text(encoding="utf-8"), encoding="utf-8")
    return roto


def una_corrida(client, python: str, numero: int,
                forzar_rechazo_inicial: bool = False,
                volcar: Path | None = None,
                caso: "Caso" = None) -> tuple[bool, str, int, dict]:
    """Una corrida completa del ciclo. Devuelve `(exitoso, motivo, intentos, diagnostico)`.

    Con `forzar_rechazo_inicial`, el veredicto del **primer** intento se descarta aunque la suite haya
    quedado verde. Es el modo **C0-DURO** y existe por una razón medida: las 12 corridas del banco
    normal acertaron al primer tiro, así que el reintento —el mecanismo construido justamente para
    garantizar el 12/12— **nunca se ejecutó** contra el modelo real. Un 12/12 en el que el reintento
    no corre no prueba que el reintento funcione: prueba que no hizo falta.

    El truco toca **sólo** el intento 1. El intento 2 pasa por el gate **real**, sin trucos: su verde
    es la suite corriendo de verdad. Lo que se mide es *"dado un rechazo con feedback localizado,
    ¿el ciclo produce un parche que el gate acepta?"* — y eso es exactamente el mecanismo.
    """
    with tempfile.TemporaryDirectory() as td:
        caja = Path(td) / "caja"
        caja.mkdir()
        caso = caso or CASO_DEFAULT
        roto = _armar_caja(caja, caso)

        rc, salida_bug = _correr_pytest(caja, python, caso.test)
        if rc == 0:
            return False, "CONTROL FALLIDO: el bug no rompe la suite — el banco no mide nada", 0, {}

        #: Los tests que el bug rompe de verdad. Se usan como feedback del rechazo forzado.
        nodeids_bug = nodeids_fallados(salida_bug)
        prompts: list[str] = []

        def forjar(prompt: str) -> str:
            prompts.append(prompt)
            r = client.chat.completions.create(
                model=os.environ.get("COPILOTO_FORJADOR_MODELO", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}], temperature=0)
            return r.choices[0].message.content or ""

        def aplicar(texto: str, contenido: str):
            return aplicar_bloques(texto, contenido)

        def auditar(texto: str, archivo: str) -> tuple[bool, str]:
            #: `salida_bug` es la MISMA evidencia que recibe el forjador. Antes el auditor sólo veía
            #: el diff y el "no romper", y con eso rechazó 3/3 el parche correcto del caso del MRO:
            #: reponer el recorrido se lee como "cambiar la lógica de herencia", justo lo que el
            #: contexto pedía no romper. Sin la causa a la vista, "¿arregla la causa?" no es
            #: contestable.
            from auditor_parches import auditar as _auditar
            v = _auditar(client, texto, f"archivo {archivo}; no romper: {caso.no_romper}",
                         evidencia=salida_bug)
            return bool(getattr(v, "aprobado", False)), getattr(v, "motivo", "")

        veces_probado = [0]

        def probar(contenido: str) -> tuple[bool, str, tuple[str, ...]]:
            """El veredicto es la SUITE VERDE, no que el parche haya aplicado."""
            veces_probado[0] += 1
            (caja / caso.archivo).write_text(contenido, encoding="utf-8")
            rc2, salida2 = _correr_pytest(caja, python, caso.test)
            resumen = parsear_resumen(salida2)
            # Se restaura el archivo roto ante CUALQUIER rechazo: el próximo intento tiene que partir
            # del MISMO estado inicial, no del que dejó el intento fallido. Sin esto, los intentos se
            # apilan y el 2º "arregla" un archivo que el 1º ya modificó — midiendo otra cosa.
            if forzar_rechazo_inicial and veces_probado[0] == 1:
                (caja / caso.archivo).write_text(roto, encoding="utf-8")
                # Motivo y nodeids con la MISMA forma que uno real —y los nodeids son los que el bug
                # rompe DE VERDAD, sacados de la corrida con el bug, no inventados. Citar un test
                # inexistente mandaría al modelo a buscar algo que no está, y estaríamos midiendo su
                # reacción a un feedback corrupto en vez de al feedback del sistema.
                return False, "la suite queda roja: 1 fallaron", nodeids_bug
            if resumen.verde:
                return True, f"ACEPTADO: {resumen.pasaron} pasaron", ()
            (caja / caso.archivo).write_text(roto, encoding="utf-8")
            return (False, f"la suite queda roja: {resumen.fallaron} fallaron",
                    nodeids_fallados(salida2))

        r = reparar(archivo=caso.archivo, contenido=roto, salida_pytest=salida_bug,
                    no_romper=caso.no_romper,
                    forjar=forjar, aplicar=aplicar, auditar=auditar, probar=probar,
                    prompt_inicial=prompt_de_forja, prompt_reintento=prompt_de_reintento)

        # Diagnóstico del reintento. Un "aceptado en el intento 2" no alcanza: si el 2º parche fuera
        # idéntico al 1º, el reintento no estaría aportando nada y el acierto sería del gate, no del
        # feedback. Y si el prompt del 2º no llevara el parche previo ni el nodeid, el modelo estaría
        # tirando de nuevo a ciegas — que es lo que empíricamente AUMENTA las regresiones.
        diag: dict = {}
        if len(r.intentos) >= 2 and len(prompts) >= 2:
            diag = {
                "parche_distinto": r.intentos[0].texto_modelo.strip() != r.intentos[1].texto_modelo.strip(),
                "prompt_lleva_el_previo": r.intentos[0].texto_modelo.strip()[:60] in prompts[1],
                # Contra los nodeids REALES del bug, no contra un nombre escrito a mano. La primera
                # versión comparaba con un literal que había quedado de una iteración anterior y daba
                # False siempre: el instrumento acusaba al sistema de un fallo que era suyo.
                "prompt_lleva_el_nodeid": bool(nodeids_bug) and any(n in prompts[1] for n in nodeids_bug),
                "cuantos_nodeids": len(nodeids_bug),
            }
        if volcar:
            volcar.write_text(
                "\n\n".join(
                    [f"### nodeids que el bug rompe ({len(nodeids_bug)}): {list(nodeids_bug)}"]
                    + [f"### PROMPT intento {i+1}\n{p}\n### RESPUESTA intento {i+1}\n"
                       f"{r.intentos[i].texto_modelo if i < len(r.intentos) else '(sin respuesta)'}"
                       for i, p in enumerate(prompts)]),
                encoding="utf-8")
        return r.exitoso, r.motivo, r.cantidad_intentos, diag


def _banco_de_casos(client, python: str) -> int:
    """Un bug real de cada clase, una corrida cada uno.

    Complementa a `--corridas`, no lo reemplaza: aquel mide **consistencia** (¿12 de 12 sobre el
    MISMO bug?), este mide **amplitud** (¿repara clases de bug distintas, en archivos distintos, con
    suites distintas?). Un ciclo que sólo sabe arreglar el bug con el que se lo entrenó pasaría el
    primero con honores y fallaría el segundo — y en producción los bugs no se eligen.

    El veredicto de cada caso es la **suite verde**, no que el parche aplique.
    """
    print(f"[banco] {len(CASOS)} casos reales, un bug distinto cada uno\n")
    resultados = []
    for caso in CASOS:
        try:
            ok, motivo, intentos, _ = una_corrida(client, python, 1, caso=caso)
        except SystemExit as exc:            # el control del bug abortó: es un fallo del BANCO
            print(f"  {caso.nombre:22s} ⚠️  {exc}")
            resultados.append((caso, False, str(exc), 0))
            continue
        except Exception as exc:  # noqa: BLE001
            ok, motivo, intentos = False, f"EXCEPCIÓN: {type(exc).__name__}: {exc}", 0
        resultados.append((caso, ok, motivo, intentos))
        print(f"  {caso.nombre:22s} {'✅' if ok else '❌'} intentos={intentos} — {motivo}")
        print(f"  {'':22s}    ({caso.por_que})")

    logrados = sum(1 for _, ok, _, _ in resultados if ok)
    print(f"\n[banco] RESULTADO: {logrados}/{len(CASOS)} casos reales resueltos")
    if logrados != len(CASOS):
        print("\n[banco] ❌ casos NO resueltos:", file=sys.stderr)
        for caso, ok, motivo, _ in resultados:
            if not ok:
                print(f"       {caso.nombre}: {motivo}", file=sys.stderr)
        return 1
    print("[banco] ✅ el ciclo repara las tres clases de bug, no sólo la que se midió 12 veces")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corridas", type=int, default=12)
    ap.add_argument("--python", default=sys.executable)
    ap.add_argument("--casos", action="store_true",
                    help="corre el banco de CASOS REALES: cada bug de `CASOS` una vez, con su "
                         "propio archivo y su propia suite. Mide amplitud (¿repara clases de bug "
                         "distintas?) donde --corridas mide consistencia sobre UNA.")
    ap.add_argument("--volcar", default="",
                    help="archivo donde volcar prompts y respuestas CRUDAS de la 1ª corrida. Sin "
                         "esto, un '0/12' sólo dice que falló, no en qué se equivocó el modelo.")
    ap.add_argument("--forzar-rechazo-inicial", action="store_true",
                    help="modo C0-DURO: descarta el veredicto del 1er intento para que el REINTENTO "
                         "se ejecute de verdad. El 2º intento pasa por el gate real, sin trucos.")
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("[c0] ❌ falta OPENAI_API_KEY", file=sys.stderr)
        return 2
    from openai import OpenAI
    client = OpenAI()

    if args.casos:
        return _banco_de_casos(client, args.python)

    modo = "C0-DURO (reintento forzado)" if args.forzar_rechazo_inicial else "C0"
    print(f"[{modo}] midiendo {args.corridas} corridas del ciclo contra el LLM real…\n")
    exitos, detalle = 0, []
    for n in range(1, args.corridas + 1):
        try:
            ok, motivo, intentos, diag = una_corrida(
                client, args.python, n, args.forzar_rechazo_inicial,
                volcar=Path(args.volcar) if (args.volcar and n == 1) else None)
        except Exception as exc:  # noqa: BLE001 — una corrida que revienta es un FALLO, no un skip
            ok, motivo, intentos, diag = False, f"EXCEPCIÓN: {type(exc).__name__}: {exc}", 0, {}
        exitos += int(ok)
        detalle.append((n, ok, intentos, motivo, diag))
        extra = ""
        if diag:
            extra = (f" [parche≠previo={diag['parche_distinto']}"
                     f" prompt_lleva_previo={diag['prompt_lleva_el_previo']}"
                     f" prompt_lleva_nodeid={diag['prompt_lleva_el_nodeid']}]")
        print(f"  corrida {n:>2}: {'✅' if ok else '❌'} intentos={intentos} — {motivo}{extra}")

    print(f"\n[{modo}] RESULTADO: {exitos}/{args.corridas}")
    # El diferencial de intentos: 12/12 siempre al 3er intento es un dato MUY distinto de 12/12 al
    # 1º, y el promedio los haría indistinguibles.
    for i in (1, 2, 3):
        cuantas = sum(1 for _, ok, k, _, _ in detalle if ok and k == i)
        if cuantas:
            print(f"       aceptados en el intento {i}: {cuantas}")

    if args.forzar_rechazo_inicial:
        # CONTROL DEL MODO DURO. Sin esto, el modo podría reportar 12/12 sin que el reintento haya
        # corrido —exactamente el agujero que este modo viene a tapar— y quedaría igual de verde.
        # Dos cosas distintas que la primera versión colapsaba en un solo mensaje —y el mensaje que
        # elegía era el FALSO: con 0 aciertos decía "el forzado no se aplicó", acusando al instrumento
        # cuando lo que había fallado era el sistema medido. Un instrumento que se echa la culpa
        # manda a depurar el lugar equivocado.
        al_primer_intento = sum(1 for _, ok, k, _, _ in detalle if ok and k == 1)
        if al_primer_intento:
            print(f"\n[{modo}] ❌ CONTROL FALLIDO: {al_primer_intento} corridas acertaron en el "
                  f"intento 1, pero el modo duro rechaza ese intento SIEMPRE. El forzado no se "
                  f"aplicó y esto no midió lo que dice medir.", file=sys.stderr)
            return 2
        if exitos == 0:
            print(f"\n[{modo}] ❌ ninguna corrida terminó con parche aceptado: con un rechazo en el "
                  f"intento 1, el ciclo NO se recupera. El reintento no está cumpliendo su función.",
                  file=sys.stderr)
            return 1
        ciegos = [n for n, ok, _, _, d in detalle
                  if ok and d and not (d["parche_distinto"] and d["prompt_lleva_el_previo"]
                                       and d["prompt_lleva_el_nodeid"])]
        if ciegos:
            print(f"\n[{modo}] ⚠️  corridas donde el 2º intento acertó SIN feedback útil "
                  f"(parche idéntico, o el prompt no llevó el previo/los nodeids): {ciegos}\n"
                  f"       acertaron por otra vía, no por el mecanismo.", file=sys.stderr)
            return 1

    if exitos != args.corridas:
        print(f"\n[{modo}] ❌ NO se alcanzó el objetivo. Corridas fallidas:", file=sys.stderr)
        for n, ok, k, motivo, _ in detalle:
            if not ok:
                print(f"       corrida {n} (intentos={k}): {motivo}", file=sys.stderr)
        return 1
    print(f"[{modo}] ✅ objetivo alcanzado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
