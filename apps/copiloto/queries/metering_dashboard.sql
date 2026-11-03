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
-- ⚠️ RLS FORCE está activo en copiloto_metering (verificado 2026-08-04 contra prod). El rol de la app
-- (PGUSER de fusion-pg.env) está sujeto a la policy tenant_isolation IGUAL que cualquier otro --
-- FORCE anula la exención de dueño. `psql "$DATABASE_URL"` desnudo, SIN declarar
-- request.jwt.claims, ve 0 FILAS SIEMPRE (ningún tenant, no "todavía no hay uso") -- así se
-- descubrió: un turno de chat real no aparecía y casi se declaró "no está escribiendo" antes de
-- correr el control (ver memoria/rls-activado-que-no-filtraba-el-dueno-esta-exento.md, mismo patrón).
-- Para el agregado CROSS-TENANT que esta query necesita, correr desde una sesión que bypasee RLS
-- (Supabase Studio → SQL Editor conecta como el superusuario `postgres`, que sí bypasea) -- NO desde
-- el rol de la app. Si sólo hay el rol de la app a mano, declarar el tenant primero y aceptar que
-- sólo se ve ESE tenant: `select set_config('request.jwt.claims', '{"cliente_id":"<uuid>"}', false);`

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

-- 4) Costo REAL en USD por tenant y modelo (últimos 30 días) — tokens_entrada/salida/cacheados.
--
-- Las columnas `tokens_*` se llenan desde que existe el desglose; las filas anteriores las tienen en NULL
-- («no informado», NO cero) y por eso quedan AFUERA de este cálculo y se reportan aparte en `filas_sin_desglose`:
-- sumarlas como cero escondería gasto, estimarles una proporción reintroduciría la adivinanza que esta
-- consulta existe para reemplazar.
--
-- Las TARIFAS son parámetros (USD por millón de tokens), no parte de la fórmula: se editan acá cuando el
-- proveedor las cambia. `cacheados` ⊂ `entrada` (OpenAI los cuenta adentro de prompt_tokens), así que la
-- entrada no cacheada es `entrada - cacheados`. `razonamiento` ⊂ `salida` y ya viene cobrado en `salida`.
-- ⚠️ Verificar las tarifas contra la página de precios del proveedor antes de citar el total.
with tarifa(model_prefijo, usd_entrada, usd_cacheada, usd_salida) as (values
    ('gpt-6-luna',   0.10, 0.010, 0.50),
    ('gpt-4o-mini',  0.15, 0.075, 0.60),
    ('gpt-4o',       2.50, 1.250, 10.00)
)
select
    m.cliente_id,
    m.model,
    count(*) filter (where m.tokens_entrada is not null)                              as turnos_con_desglose,
    count(*) filter (where m.tokens_entrada is null)                                  as filas_sin_desglose,
    sum(m.tokens_entrada)                                                             as tokens_entrada,
    sum(m.tokens_cacheados)                                                           as tokens_cacheados,
    sum(m.tokens_salida)                                                              as tokens_salida,
    round((sum(coalesce(m.tokens_entrada, 0) - coalesce(m.tokens_cacheados, 0)) * t.usd_entrada
         + sum(coalesce(m.tokens_cacheados, 0)) * t.usd_cacheada
         + sum(coalesce(m.tokens_salida, 0)) * t.usd_salida) / 1e6, 4)                as usd
from uc_factory.copiloto_metering m
left join lateral (select * from tarifa t where m.model like t.model_prefijo || '%'
                   order by length(t.model_prefijo) desc limit 1) t on true
where m.evento = 'llm_turno' and m.created_at > now() - interval '30 days'
group by m.cliente_id, m.model, t.usd_entrada, t.usd_cacheada, t.usd_salida
order by usd desc nulls last;
