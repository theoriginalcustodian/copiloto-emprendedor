"""Tests de los tipos ReAct (ToolCall/ToolResult/Artifact) + verificación de que DispatchResult
queda intacto (no se le agrega `artifact`, se descartó por código muerto — ver types.py)."""
from backend.agent.types import ToolCall, ToolResult, Artifact, DispatchResult


def test_toolcall_roundtrip():
    tc = ToolCall(id="call_1", name="mp_charge", arguments={"amount": 5000})
    assert ToolCall.from_dict(tc.to_dict()) == tc


def test_toolresult_with_artifact_roundtrip():
    tr = ToolResult(tool_call_id="call_1",
                    observation={"init_point": "https://mpago.la/x"},
                    artifact=Artifact(kind="payment_link", data={"url": "https://mpago.la/x", "amount": 5000}),
                    is_write=True, status="ok")
    d = tr.to_dict()
    assert d["artifact"]["kind"] == "payment_link"
    back = ToolResult.from_dict(d)
    assert back.artifact.kind == "payment_link"
    assert back.is_write is True


def test_dispatchresult_unchanged():
    # el shape existente de DispatchResult sobrevive intacto (no se le agrega artifact)
    dr = DispatchResult(reply_text="hola")
    assert DispatchResult.from_dict(dr.to_dict()).reply_text == "hola"
