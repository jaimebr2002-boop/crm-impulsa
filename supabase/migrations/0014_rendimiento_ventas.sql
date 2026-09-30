-- ============================================================
-- 0014 · Rendimiento de Ventas con decenas de miles de leads
-- ============================================================
-- Sin cambios de datos ni de permisos: índices y dos funciones de solo lectura
-- (security invoker → RLS sigue aplicando: un comercial solo cuenta sus leads).
-- Idempotente.

-- 1. Búsqueda por texto (ilike '%…%') sobre los campos que usa la lista de leads.
create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_leads_trgm_negocio on public.leads using gin (negocio extensions.gin_trgm_ops);
create index if not exists idx_leads_trgm_contacto on public.leads using gin (nombre_contacto extensions.gin_trgm_ops);
create index if not exists idx_leads_trgm_telefono on public.leads using gin (telefono extensions.gin_trgm_ops);
create index if not exists idx_leads_trgm_email on public.leads using gin (email extensions.gin_trgm_ops);
create index if not exists idx_leads_trgm_instagram on public.leads using gin (instagram extensions.gin_trgm_ops);
create index if not exists idx_leads_trgm_ciudad on public.leads using gin (ciudad extensions.gin_trgm_ops);

-- 2. Orden de la lista (más recientes primero) con el filtro de archivado, sin ordenar en memoria.
create index if not exists idx_leads_lista on public.leads (archivado, updated_at desc, id);
create index if not exists idx_leads_asignado_lista on public.leads (asignado_a, archivado, updated_at desc);
create index if not exists idx_leads_created_at on public.leads (created_at);

-- 3. Pipeline actual: leads activos por estado, con su valor. Sustituye a
--    descargar todos los leads solo para contarlos.
create or replace function public.resumen_pipeline_leads(p_usuario uuid default null)
returns table (estado text, n bigint, valor numeric, sin_valor bigint)
language sql stable security invoker set search_path = public as $$
  select l.estado, count(*), coalesce(sum(l.valor), 0), count(*) filter (where l.valor is null)
  from leads l
  where not l.archivado and (p_usuario is null or l.asignado_a = p_usuario)
  group by l.estado
$$;

-- 4. Leads creados en un periodo, agrupados (día UTC, estado, origen, responsable).
create or replace function public.resumen_leads_periodo(p_desde timestamptz, p_hasta timestamptz, p_usuario uuid default null)
returns table (dia date, estado text, origen text, asignado_a uuid, n bigint, valor numeric, con_valor bigint)
language sql stable security invoker set search_path = public as $$
  select (l.created_at at time zone 'UTC')::date, l.estado, l.origen, l.asignado_a,
         count(*), coalesce(sum(l.valor), 0), count(l.valor)
  from leads l
  where l.created_at >= p_desde and l.created_at <= p_hasta
    and (p_usuario is null or l.asignado_a = p_usuario)
  group by 1, 2, 3, 4
$$;

revoke execute on function public.resumen_pipeline_leads(uuid) from public, anon;
revoke execute on function public.resumen_leads_periodo(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.resumen_pipeline_leads(uuid) to authenticated;
grant execute on function public.resumen_leads_periodo(timestamptz, timestamptz, uuid) to authenticated;
