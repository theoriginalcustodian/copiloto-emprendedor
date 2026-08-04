-- metering_dashboard.sql (BETA-1b) — uso, error-rate y gasto LLM por tenant.
--
-- Sin UI de admin en esta etapa (mismo criterio que copiloto_feedback, mapa M4-nota): el operador
-- corre esto con SQL directo. Fuente: uc_factory.copiloto_metering, poblada por MeteringStore vía el
-- boundary metering_sink (agent_activities.call_llm_tools / execute_tool en motor/).
--
-- evento = 'llm_turno'          -> una llamada al LLM (model = id real, tokens = total_tokens)
-- evento = 'tool_call:<status>' -> una tool ejecutada (model = 'tool:<nombre>', tokens = NULL;
--                                  status ∈ ok|error|rejected|needs_confirmation, ver ToolResult)
--
-- Uso (ejemplo, últimas 24h): psql "$DATABASE_URL" -f apps/copiloto/queries/metering_dashboard.sql

-- 1) Gasto LLM + turnos por tenant (últimas 24h)
select
    cliente_id,
    count(*) filter (where evento = 'llm_turno')                as turnos_llm,
    coalesce(sum(tokens) filter (where evento = 'llm_turno'), 0) as tokens_totales,
    mode() within group (order by model) filter (where evento = 'llm_turno') as modelo_mas_usado
from uc_factory.copiloto_metering
where created_at > now() - interval '24 hours'
group by cliente_id
order by tokens_totales desc;

-- 2) Uso de tools por tenant (últimas 24h)
select
    cliente_id,
    split_part(model, ':', 2) as tool,
    count(*) as llamadas
from uc_factory.copiloto_metering
where evento like 'tool_call:%' and created_at > now() - interval '24 hours'
group by cliente_id, tool
order by cliente_id, llamadas desc;

-- 3) Error-rate de tools por tenant (últimas 24h) — el número que importa para salud del agente
select
    cliente_id,
    count(*) filter (where evento = 'tool_call:error')            as errores,
    count(*) filter (where evento like 'tool_call:%')              as llamadas_totales,
    round(
        100.0 * count(*) filter (where evento = 'tool_call:error')
        / nullif(count(*) filter (where evento like 'tool_call:%'), 0), 1
    ) as error_rate_pct
from uc_factory.copiloto_metering
where created_at > now() - interval '24 hours'
group by cliente_id
order by error_rate_pct desc nulls last;
