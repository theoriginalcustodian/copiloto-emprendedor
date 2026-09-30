#!/usr/bin/env python3
"""Reporta la VIGENCIA de las mediciones del criterio 3: que documento supera a cual.

Fila `VIGENCIA` del PLAN, paso 2 de 3. Dueno: auditoria.

QUE HACE Y QUE NO
-----------------
REPORTA. No mueve archivos, no excluye filas de ningun contraste, no toca
`contar-veredictos.py`. El paso 3 -- que el contraste EXCLUYA las filas retiradas en vez de
exhibirlas como conflicto -- es de planificacion, y este script existe para que ese paso tenga
un insumo legible antes de escribirse.

Por que reportador y no actor: la cobertura de la convencion es 2 de 3 sucesores (medido, ver
el registro §1). Un excluidor que arrancara hoy afectaria un punado de filas, y su "no hizo
nada" seria INDISTINGUIBLE de un glob roto -- el mismo filo que `retirados_obsoletos=0`. La
regla es de `memoria/medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria.md`:
primero se exige al escribir, despues se lee, y solo al final se actua.

LA DIRECCION DE LA FLECHA
-------------------------
La declaracion la lleva el SUCESOR (`SUPERSEDE:`), no el retirado. Un documento no puede saber
que sera superado: cuando se emitio era la medicion vigente. Buscar el retiro en el documento
retirado es buscarlo en el unico lugar donde por construccion no puede estar -- y fue lo que
dejo el hueco vivo (`contar-veredictos.py:111-116`).

EL UNIVERSO NO SE COPIA
-----------------------
`MEDICIONES_DECLARADAS` se extrae de `contar-veredictos.py` por AST, sin ejecutarlo. Copiar el
set aca crearia una segunda definicion del universo que divergiria en silencio, que es el
defecto de los clientes gemelos (`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`).

EXIT CODES
----------
  0  reporte OK (con o sin documentos retirados: cero retirados es un estado legitimo)
  2  SIN MEDIR -- no se pudo leer el registro, el buzon o el parser. NO es un rojo del sujeto.
  3  control POSITIVO en rojo -- el instrumento no reproduce un hecho ya afirmado por su autor
  4  control NEGATIVO en rojo -- el instrumento acepta una relacion inventada
  5  cadena ROTA -- un `SUPERSEDE:`/`COMPLEMENTA:`/`CORRIGE_FILAS:` apunta a un doc que no existe
  6  CAMPOS incompletos -- una relacion sin `ALCANCE:` (el paso 3 no sabe cuantas filas retirar)
  8  ANCLA en rojo -- la cita que el registro afirma NO esta en el documento de su autor
  9  ENCABEZADO MUDO -- un `### <doc>.md` que no produjo ninguna relacion. Existe porque la 5a
     relacion desaparecio del reporte sin un solo error: el encabezado habia quedado DENTRO del
     fence (la plantilla del registro lo mostraba asi) y el parser no leyo sus campos. Una
     relacion que se pierde en silencio es peor que un rojo.

TRES REGIMENES, NO UNO (medido 2026-09-30)
------------------------------------------
`SUPERSEDE`/`COMPLEMENTA` relacionan DOCUMENTOS. Pero la invalidacion a nivel FILA tiene su
propio documento canonico y su propia regla, y su unico caso se resolvio de una tercera forma:
el autor corrigio la fila DENTRO del mismo archivo, sin sucesor y sin cambiar de path
(`CORRIGE_FILAS:`). Un excluidor por (documento, id) no ve esa correccion: para los dos lados
del par el path y el id son iguales, y lo que cambio vive adentro
(`memoria/un-control-a-nivel-archivo-no-ve-la-divergencia-adentro.md`). Por eso `CORRIGE_FILAS`
NO cuenta como retiro: el documento citado sigue vigente -- lo que caduco es usarlo como fuente
de exclusion.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

# El registro se lee en UTF-8 y sus valores traen `·`, `«»`, acentos. La consola de Windows es
# cp1252, asi que el `print` de una cita del autor explota a MITAD del reporte -- con datos
# validos ya impresos y un exit != 0 que no habla del sujeto sino del terminal. Se arregla en el
# punto que esta roto (la salida), no mutilando el registro.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAIZ = Path(__file__).resolve().parents[2]
PARSER = RAIZ / "scripts" / "evidencia" / "contar-veredictos.py"
REGISTRO = (RAIZ / "docs" / "copiloto-emprendedor" / "Auditorias"
            / "2026-09-30-registro-de-vigencia-la-sucesion-la-declara-el-sucesor.md")
# El buzon NO esta versionado (0 archivos en origin/main), asi que puede no existir: es un
# `SIN MEDIR` (exit 2), nunca un cero silencioso.
BUZON = RAIZ.parent / "copiloto-emprendedor" / "coordinacion"
BUZON_ALT = Path("C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion")

# ── El formato: un bloque por sucesor, con el ancla `CLAVE: valor` que el repo ya usa ──────────
# Tolerante a markdown (negritas, backticks, viñeta) igual que el ancla `DISPARADOR:` de
# `escaladores-buzon.sh:274`, porque el registro es un documento que tambien lee un humano.
CAMPO = re.compile(
    r"^\s*(?:[-*]\s*)?\**(SUPERSEDE|COMPLEMENTA|CORRIGE_FILAS|ALCANCE|IDS|ANCLA|FORMA|DECLARANTE)\**\s*:\s*\**\s*`?([^`\n]*?)`?\s*\**\s*$",
    re.IGNORECASE,
)
ENCABEZADO = re.compile(r"^###\s+`?([^`\s]+\.md)`?\s*$")

# ── Control POSITIVO, anclado AFUERA del instrumento ──────────────────────────────────────────
# No es "el regex matchea algo": es un hecho que OTRO documento ya afirma, y que este lector
# esta obligado a reproducir. FE1 escribio el 22/09, en el encabezado de su re-medicion, que su
# barrido anterior queda invalidado como evidencia. Si este script no lo ve, el script esta roto
# -- no el corpus. (`memoria/medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria.md`,
# tercer regimen: el control construido desde el propio instrumento pasa siempre.)
CONTROL_POS = (
    "2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md",
    "2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md",
)
# Control NEGATIVO: una relacion inventada no puede aparecer. Sin esto, un parser que devuelva
# cualquier cosa para cualquier entrada saldria verde en el positivo igual.
CONTROL_NEG = "2026-09-22_dato_frontend9-a-planificacion_documento-que-no-existe.md"


def morir(codigo: int, msg: str) -> None:
    print(f"\n{msg}")
    sys.exit(codigo)


def universo_declarado() -> set[str]:
    """`MEDICIONES_DECLARADAS` del parser, por AST. Sin ejecutar nada."""
    if not PARSER.is_file():
        morir(2, f"SIN MEDIR: no encuentro el parser en {PARSER}")
    arbol = ast.parse(PARSER.read_text(encoding="utf-8"))
    for nodo in arbol.body:
        if isinstance(nodo, ast.Assign):
            for destino in nodo.targets:
                if isinstance(destino, ast.Name) and destino.id == "MEDICIONES_DECLARADAS":
                    valor = ast.literal_eval(nodo.value)
                    return {str(v) for v in valor}
    morir(2, "SIN MEDIR: `MEDICIONES_DECLARADAS` no esta en el parser -- se renombro. "
             "Este script lo IMPORTA a proposito para no tener una segunda copia del universo.")
    return set()  # inalcanzable


def leer_registro() -> tuple[list[dict], list[str]]:
    if not REGISTRO.is_file():
        morir(2, f"SIN MEDIR: no encuentro el registro en {REGISTRO}")
    entradas: list[dict] = []
    # El bloque se emite al CERRARSE (siguiente encabezado o EOF), no al encontrar la relacion.
    # Bug medido 2026-09-30: emitir en el `SUPERSEDE:` congelaba el dict antes de leer
    # `ALCANCE`/`DECLARANTE`, que vienen DESPUES en el bloque -- las 4 entradas salian
    # `alcance=?`. Es el patron de
    # `memoria/un-enum-al-final-del-renglon-lo-borra-el-que-appendea.md`: quien appendea
    # temprano publica un estado incompleto, y el campo que falta parece ausente del corpus.
    mudos: list[str] = []
    bloque: dict | None = None
    rels: list[tuple[str, str]] = []
    # Los campos se leen SOLO dentro del fence ``` que sigue al `###`, y el fence CIERRA el bloque.
    # Bug medido 2026-09-30, destapado por la 5a relacion: el bloque no tenia delimitador de cierre,
    # asi que el ultimo quedaba abierto hasta EOF y absorbia las lineas `ALCANCE:` de la SALIDA DE
    # ESTE MISMO SCRIPT que el registro transcribe en sus secciones 5 y 6. El `alcance` real (`total`)
    # se perdia y el control CAMPOS pasaba igual, satisfecho con basura -- un fail-open.
    # No daba sintoma con 4 bloques porque a cada uno lo seguia otro `###`
    # (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`), y el parser no distinguia una
    # declaracion de una transcripcion de su propia salida
    # (`memoria/el-guard-se-satisface-con-su-propio-comentario.md`).
    dentro_fence = False

    def cerrar() -> None:
        if bloque is None:
            return
        if not rels:
            mudos.append(bloque["sucesor"])
        for rel, otro in rels:
            e = dict(bloque)
            e["rel"], e["otro"] = rel, otro
            entradas.append(e)

    for linea in REGISTRO.read_text(encoding="utf-8").splitlines():
        enc = ENCABEZADO.match(linea)
        if enc:
            cerrar()
            bloque = {"sucesor": enc.group(1)}
            rels = []
            dentro_fence = False
            continue
        if bloque is None:
            continue
        if linea.strip().startswith("```"):
            if not dentro_fence:
                dentro_fence = True
            else:
                cerrar()
                bloque, rels, dentro_fence = None, [], False
            continue
        if not dentro_fence:
            continue
        campo = CAMPO.match(linea)
        if campo:
            clave, valor = campo.group(1).upper(), campo.group(2).strip()
            if clave in ("SUPERSEDE", "COMPLEMENTA", "CORRIGE_FILAS"):
                rels.append((clave, valor))
            else:
                bloque[clave.lower()] = valor
    cerrar()
    return entradas, mudos


def main() -> int:
    # `--registro <path>`: sustituye el registro por otro. Existe para el CANARIO -- inyectar un
    # registro deliberadamente roto y exigir el exit code que corresponde, sin mutar el original.
    # Sin esto, los 5 controles nunca se ejercitan en rojo y no se sabe si pueden fallar
    # (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`).
    global REGISTRO
    if "--registro" in sys.argv:
        i = sys.argv.index("--registro")
        if i + 1 >= len(sys.argv):
            morir(2, "SIN MEDIR: --registro sin valor.")
        REGISTRO = Path(sys.argv[i + 1])
        print(f"[canario] registro sustituido por {REGISTRO}")

    # `--buzon <path>`: sustituye el corpus. Existe porque el buzon NO esta versionado, asi que en
    # un clon limpio (el CI) este script sale 2 SIN MEDIR ANTES de llegar a un solo control -- y un
    # canario que dependa del corpus real es un test que el gate no puede correr. `scripts/ci/lint.sh`
    # lo dice de si mismo: «un test que nadie ejecuta no es un control, es un archivo».
    # Lo que el fixture verifica es el INSTRUMENTO -- que cada control PUEDE ponerse rojo. Lo que NO
    # verifica es que las anclas del corpus real sean ciertas: eso lo prueba la corrida contra el
    # buzon real, que el canario suma como caso extra cuando el buzon existe.
    if "--buzon" in sys.argv:
        i = sys.argv.index("--buzon")
        if i + 1 >= len(sys.argv):
            morir(2, "SIN MEDIR: --buzon sin valor.")
        buzon = Path(sys.argv[i + 1])
        print(f"[canario] buzon sustituido por {buzon}")
    else:
        buzon = BUZON if BUZON.is_dir() else BUZON_ALT
    if not buzon.is_dir():
        morir(2, "SIN MEDIR: el buzon no existe en este checkout. NO esta versionado "
                 "(0 archivos en origin/main), asi que en un clon limpio esto es lo esperado "
                 "-- no un cero del corpus.")

    universo = universo_declarado()
    entradas, mudos = leer_registro()
    paths_buzon: dict[str, Path] = {}
    for _p in buzon.rglob("*.md"):
        paths_buzon.setdefault(_p.name, _p)
    presentes = set(paths_buzon)

    print("=" * 96)
    print("VIGENCIA DE LAS MEDICIONES -- reportador (no excluye ni mueve nada)")
    print("=" * 96)
    # `relative_to` solo vale para el registro del repo; el del canario vive afuera y explotaba
    # con ValueError -> exit 1, INDISTINGUIBLE de «el control no se activo». El andamio del
    # canario no puede romper antes de llegar al guard que viene a ejercitar.
    try:
        ubic = REGISTRO.relative_to(RAIZ)
    except ValueError:
        ubic = REGISTRO
    print(f"registro : {ubic}")
    print(f"universo : {len(universo)} documentos en MEDICIONES_DECLARADAS (leidos por AST del parser)")
    print(f"buzon    : {len(presentes)} archivos .md encontrados en {buzon}")

    if not presentes:
        morir(2, "SIN MEDIR: el glob no encontro NINGUN .md en el buzon. Cero relaciones aca "
                 "significaria 'no mire', no 'no hay'.")

    # ── control de la CADENA: una relacion a un documento inexistente es una cadena rota ───────
    rotas = [e for e in entradas if e["otro"] not in presentes]
    # ── el reporte ────────────────────────────────────────────────────────────────────────────
    print(f"\nRELACIONES DECLARADAS: {len(entradas)}")
    print("-" * 96)
    superados: dict[str, list[dict]] = {}
    for e in entradas:
        marca = "!" if e["otro"] not in presentes else " "
        en_univ = "en universo" if e["sucesor"] in universo else "FUERA del universo"
        alcance = e.get("alcance", "?")
        print(f" {marca} {e['rel']:12s} {e['sucesor'][:58]}")
        print(f"     -> {e['otro'][:70]}")
        print(f"        alcance={alcance} | sucesor {en_univ} | declarante: {e.get('declarante','?')[:40]}")
        if e["rel"] == "CORRIGE_FILAS":
            print(f"        ^ regimen POR FILA: corrige in-situ ({e.get('forma','?')}). "
                  f"NO retira el doc citado -- caduca usarlo como fuente de exclusion")
        if e["rel"] == "SUPERSEDE":
            superados.setdefault(e["otro"], []).append(e)

    # ── cobertura: de los documentos del universo, cuantos tienen relacion declarada ───────────
    con_rel = {e["sucesor"] for e in entradas} | set(superados)
    del_universo = {d for d in con_rel if d in universo}
    print("-" * 96)
    print(f"COBERTURA: {len(del_universo)} de {len(universo)} documentos del universo aparecen "
          f"en alguna relacion de vigencia")
    print(f"RETIRADOS (total o parcial): {len(superados)} de {len(universo)} -- "
          + (", ".join(sorted(d[:46] for d in superados)) if superados else "ninguno"))
    parciales = sum(1 for e in entradas if e.get("alcance", "").lower().startswith("parcial"))
    sin_alcance = [e for e in entradas if not e.get("alcance")]
    print(f"ALCANCE: {parciales} de {len(entradas)} relaciones son PARCIALES -- el paso 3 tiene que "
          f"excluir POR FILA, no por documento")

    # ── los 4 controles ───────────────────────────────────────────────────────────────────────
    print("\nCONTROLES")
    print("-" * 96)
    retirado_esperado, sucesor_esperado = CONTROL_POS
    ok_pos = any(e["rel"] == "SUPERSEDE" and e["otro"] == retirado_esperado
                 and e["sucesor"] == sucesor_esperado for e in entradas)
    print(f" POSITIVO (externo: lo afirmo FE1 el 22/09) ... {'ok' if ok_pos else 'ROJO'}")
    print(f"   el barrido de 35 pantallas tiene que salir SUPERSEDE por matriz-web-re-medida")
    ok_neg = not any(CONTROL_NEG in (e["otro"], e["sucesor"]) for e in entradas)
    print(f" NEGATIVO (relacion inventada) .............. {'ok' if ok_neg else 'ROJO'}")
    ok_desc = bool(presentes) and bool(universo)
    print(f" DESCUBRIMIENTO (universo y buzon no vacios)  {'ok' if ok_desc else 'ROJO'}")
    ok_cadena = not rotas
    print(f" CADENA (toda relacion apunta a un doc real)  {'ok' if ok_cadena else 'ROJO'}")
    for e in rotas:
        print(f"   ! {e['sucesor'][:40]} -> {e['otro'][:50]} NO esta en el buzon")
    # Un `alcance` ausente NO es cosmetico: el paso 3 excluye POR FILA y sin alcance no sabe
    # cuantas filas retirar. Se imprimia como `alcance=?` -- un vacio que no grita, que es la
    # forma en que un campo faltante se lee como ausente del corpus en vez de ausente del lector.
    ok_campos = not sin_alcance
    print(f" CAMPOS (toda relacion declara ALCANCE) ..... {'ok' if ok_campos else 'ROJO'}")
    for e in sin_alcance:
        print(f"   ! {e['sucesor'][:40]} -> {e['otro'][:46]} sin ALCANCE")

    # ANCLA: la cita que este registro pone en boca de un autor tiene que ESTAR en su documento.
    # Sin este control, el registro afirma relaciones cuya evidencia nadie re-lee -- y una cita
    # copiada de memoria o de otro documento se lee igual de bien que una verdadera.
    # Es el control positivo POR RELACION, y va anclado afuera: el texto lo escribio su autor.
    ok_mudo = not mudos
    print(f" MUDO (todo encabezado produce relacion) .... {'ok' if ok_mudo else 'ROJO'}")
    for m in mudos:
        print(f"   ! {m[:56]} no produjo NINGUNA relacion -- campos fuera del fence?")
    sin_ancla = [e for e in entradas if not e.get("ancla")]
    ancla_rota = []
    for e in entradas:
        a = e.get("ancla")
        if not a:
            continue
        f = paths_buzon.get(e["sucesor"])
        if f is None or a not in f.read_text(encoding="utf-8", errors="replace"):
            ancla_rota.append(e)
    ok_ancla = not sin_ancla and not ancla_rota
    print(f" ANCLA (la cita existe en el doc de su autor) {'ok' if ok_ancla else 'ROJO'}"
          f"   [{len(entradas) - len(sin_ancla) - len(ancla_rota)} de {len(entradas)} verificadas]")
    for e in sin_ancla:
        print(f"   ! {e['sucesor'][:46]} sin ANCLA -- la cita no es verificable")
    for e in ancla_rota:
        print(f"   ! {e['sucesor'][:46]}: «{e['ancla'][:44]}» NO aparece en el documento")

    if not ok_pos:
        morir(3, "CONTROL POSITIVO EN ROJO: el reportador no reproduce el retiro que FE1 declaro "
                 "en su propio documento el 22/09. El instrumento esta roto, no el corpus.")
    if not ok_neg:
        morir(4, "CONTROL NEGATIVO EN ROJO: el reportador acepto una relacion inventada.")
    if not ok_desc:
        morir(2, "SIN MEDIR: universo o buzon vacios.")
    if not ok_cadena:
        morir(5, "CADENA ROTA: hay relaciones que apuntan a documentos ausentes del buzon. "
                 "Un retiro hacia un documento que no existe no se puede aplicar.")
    if not ok_mudo:
        morir(9, "ENCABEZADO MUDO: hay un `### <doc>.md` que no produjo ninguna relacion. Sus "
                 "campos quedaron fuera del fence y el reporte perdio la relacion en silencio.")
    if not ok_ancla:
        morir(8, "ANCLA EN ROJO: el registro afirma una cita que no esta en el documento de su "
                 "autor. Una relacion cuya evidencia no se puede releer no es una relacion.")
    if not ok_campos:
        morir(6, "CAMPOS INCOMPLETOS: hay relaciones sin ALCANCE. El paso 3 excluye por fila y "
                 "sin alcance no puede saber cuantas.")

    print("\n" + "=" * 96)
    print("VERDICTO: REPORTE COMPLETO -- 7 de 7 controles en verde. Nada fue excluido ni movido.")
    print("El paso 3 (que el contraste excluya las filas retiradas) es de planificacion, y su "
          "control\nes: una fila retirada no puede aparecer como conflicto NUEVO.")
    print("=" * 96)
    return 0


if __name__ == "__main__":
    sys.exit(main())
