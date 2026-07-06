"""QA de PRECISIÓN DE SELECCIÓN de tool (el 'tool overload' real de este agente, que NO usa function-calling).

Con el system prompt COMPLETO (base + fragmentos de los 7 servicios), ¿gpt-4o-mini emite el {action/service/op}
correcto para utterances naturales? Mide la precisión con el modelo REAL. Corre EN EL VPS (OPENAI_API_KEY).
Este es el gate que reemplaza al 'gating por tool-defs' (que no aplica): si la precisión baja, se afina el prompt."""
import os
import sys
from pathlib import Path


import pytest
from clients.agent.providers.llm import LlmProvider
import services
from system_prompt import SYSTEM_PROMPT

# (utterance, action esperada, service esperado|None, op esperado|None)  — Calendar usa 'book' (no tool_action)
CASES = [
    ("mandá un mail a juan@x.com avisando que llego 10 minutos tarde", "tool_action", "gmail", "send"),
    ("fijate si tengo correos sin leer", "tool_action", "gmail", "fetch"),
    ("agendá una reunión el jueves a las 15", "book", None, None),
    ("creá un archivo en drive llamado notas.txt con el texto hola mundo", "tool_action", "drive", "create_file"),
    ("armá un documento en docs titulado Informe Q3", "tool_action", "docs", "create_doc"),
    ("agregá a ana@empresa.com como contacto nuevo en el crm", "tool_action", "hubspot", "create_contact"),
    ("escribí una fila con los valores 1, 2, 3 en la planilla id abc123", "tool_action", "sheets", "append_row"),
    ("mostrame los datos de mi cuenta de instagram", "tool_action", "instagram", "account"),
]


@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="QA real: requiere OPENAI_API_KEY (gpt-4o-mini)")
def test_seleccion_gpt4omini():
    llm = LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                      api_key_env="OPENAI_API_KEY", url="https://api.openai.com/v1/chat/completions",
                      quantizations=())
    system = SYSTEM_PROMPT + "\n" + services.prompt_fragments()

    ok = 0
    fails = []
    for utt, exp_action, exp_svc, exp_op in CASES:
        res = llm.complete(system, utt)
        p = res.get("parsed") or {}
        act = p.get("action")
        ent = p.get("entities") or {}
        good = (act == exp_action
                and (exp_svc is None or ent.get("service") == exp_svc)
                and (exp_op is None or ent.get("op") == exp_op))
        if good:
            ok += 1
        else:
            fails.append({"utt": utt, "got_action": act, "got_service": ent.get("service"), "got_op": ent.get("op"),
                          "exp": (exp_action, exp_svc, exp_op)})
    acc = ok / len(CASES)
    print(f"\nSELECTION ACCURACY (gpt-4o-mini, {len(CASES)} casos): {ok}/{len(CASES)} = {acc:.0%}")
    for f in fails:
        print("  MISS:", f)
    assert acc >= 0.875, f"precisión de selección baja ({acc:.0%}); revisar prompts: {fails}"
