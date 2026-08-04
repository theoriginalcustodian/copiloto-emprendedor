-- feedback_dashboard.sql (BETA-4a) — vista de revisión cross-tenant sobre copiloto_feedback.
--
-- Es LECTURA, no un sistema nuevo (contrato §3.1, addendum 2026-08-04, respondiendo
-- dato_backend-a-planificacion_BETA4a-vista-de-revision-cross-tenant-o-per-tenant.md): no se
-- construye auth admin nueva. Mismo patrón exacto que metering_dashboard.sql (BETA-1b, PR#228) --
-- el operador corre esto con SQL directo, sin UI de admin en esta etapa.
--
-- Fuente: uc_factory.copiloto_feedback, poblada por FeedbackStore.crear() (feedback_store.py) desde
-- POST /feedback (BETA-1a) -- voz y texto, una fila por envío.
--
-- ⚠️ RLS FORCE está activo en copiloto_feedback (misma tabla-patrón que copiloto_metering,
-- verificado 2026-08-04 -- ver metering_dashboard.sql y
-- memoria/rls-activado-que-no-filtraba-el-dueno-esta-exento.md). `psql "$DATABASE_URL"` desnudo, SIN
-- declarar request.jwt.claims, ve 0 FILAS SIEMPRE (ningún tenant, no "sin feedback todavía").
-- Para el agregado CROSS-TENANT que esta vista necesita, correr desde una sesión que bypasee RLS
-- (Supabase Studio → SQL Editor conecta como el superusuario `postgres`, que sí bypasea) -- NO desde
-- el rol de la app. Si sólo hay el rol de la app a mano, declarar el tenant primero y aceptar que
-- sólo se ve ESE tenant: `select set_config('request.jwt.claims', '{"cliente_id":"<uuid>"}', false);`

-- 1) Todo el feedback, más reciente primero, con el email del emprendedor que lo mandó
select
    f.id,
    t.email          as emprendedor,
    f.tipo,          -- 'texto' | 'voz'
    f.texto,
    f.contexto,
    f.created_at
from uc_factory.copiloto_feedback f
join uc_factory.tenants t on t.cliente_id = f.cliente_id
order by f.created_at desc;

-- 2) Volumen por emprendedor y tipo (para ver quién manda feedback y cuánto)
select
    t.email as emprendedor,
    f.tipo,
    count(*) as envios,
    max(f.created_at) as ultimo_envio
from uc_factory.copiloto_feedback f
join uc_factory.tenants t on t.cliente_id = f.cliente_id
group by t.email, f.tipo
order by envios desc;

-- 3) Últimas 24h -- lo que hay que revisar HOY
select
    t.email as emprendedor,
    f.tipo,
    f.texto,
    f.contexto,
    f.created_at
from uc_factory.copiloto_feedback f
join uc_factory.tenants t on t.cliente_id = f.cliente_id
where f.created_at > now() - interval '24 hours'
order by f.created_at desc;
