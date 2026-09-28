-- Company OS — Fase 1: cuentas, marcas, proyectos, enlaces, tareas y actividad.
--
-- Solo añade objetos nuevos (tablas, funciones, triggers, políticas) y corrige
-- handle_new_user(). No borra ni modifica datos existentes. Idempotente.
--
-- Permisos:
--   · cuentas, marcas, proyectos, enlaces y actividad → solo admin.
--   · tareas → admin ve todas; un comercial ve las que crea o tiene asignadas
--     y solo puede ligarlas a sus propios leads (nunca a proyectos).
--   · actividad → la escriben únicamente los triggers (SECURITY DEFINER).

-- ============================================================
-- 0. Seguridad: el rol ya no se toma de user_metadata
-- ============================================================
-- raw_user_meta_data lo puede fijar el propio usuario al registrarse, así que
-- no sirve para autorizar. Toda cuenta nueva nace 'comercial'; para hacer admin
-- a alguien: update usuarios set rol = 'admin' where email = '…';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, email, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    'comercial'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- El trigger de 0006 bloqueaba también el SQL Editor (allí auth.uid() es null
-- y is_admin() da false), así que era imposible ascender a nadie a admin.
-- La restricción solo tiene sentido para peticiones de usuarios de la app.
create or replace function usuarios_restringir_autoedicion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.rol is distinct from old.rol
      or new.nombre is distinct from old.nombre
      or new.email is distinct from old.email
      or new.id is distinct from old.id then
      raise exception 'No tienes permiso para modificar estos campos.';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 1. cuentas — de dónde viene el trabajo (Fer, un cliente directo…)
-- ============================================================
create table if not exists cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  tipo text not null default 'intermediario'
    check (tipo in ('intermediario', 'cliente_directo', 'interno')),
  email text,
  telefono text,
  notas text,
  -- Si la cuenta nació de convertir un lead ganado. Un lead → como mucho una cuenta.
  lead_id uuid references leads(id) on delete set null,
  archivada boolean not null default false,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_cuentas_lead_id on cuentas (lead_id) where lead_id is not null;
-- Una sola "Fer": el nombre no se repite (sin distinguir mayúsculas).
create unique index if not exists uq_cuentas_nombre on cuentas (lower(trim(nombre)));
create index if not exists idx_cuentas_archivada on cuentas (archivada);

comment on table cuentas is 'Origen del trabajo: un intermediario (p. ej. Fer) o un cliente directo. No tienen acceso a la app.';

-- ============================================================
-- 2. marcas — empresas/marcas finales de una cuenta (Segurma, Clínica X…)
-- ============================================================
create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references cuentas(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  web text,
  notas text,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marcas_cuenta_id on marcas (cuenta_id);
create unique index if not exists uq_marcas_cuenta_nombre on marcas (cuenta_id, lower(trim(nombre)));

-- ============================================================
-- 3. proyectos
-- ============================================================
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  cuenta_id uuid references cuentas(id) on delete set null,
  marca_id uuid references marcas(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  tipo text not null default 'otro'
    check (tipo in ('video', 'campana', 'creativo', 'web', 'app', 'automatizacion', 'anuncio', 'tecnico', 'contenido', 'revision', 'otro')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'preparado', 'en_progreso', 'esperando', 'revision', 'entregado', 'cancelado')),
  prioridad text not null default 'normal'
    check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  responsable_id uuid references usuarios(id) on delete set null default auth.uid(),
  fecha_inicio date,
  fecha_entrega date,
  -- Lo rellena el trigger al pasar a 'entregado' → métrica de entregas a tiempo.
  entregado_en timestamptz,
  -- Importe acordado. Lo facturado/cobrado se derivará de facturas (Fase 3).
  importe numeric(12, 2) check (importe is null or importe >= 0),
  notas text,
  archivado boolean not null default false,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proyectos_estado on proyectos (estado) where not archivado;
create index if not exists idx_proyectos_cuenta_id on proyectos (cuenta_id);
create index if not exists idx_proyectos_marca_id on proyectos (marca_id);
create index if not exists idx_proyectos_lead_id on proyectos (lead_id);
create index if not exists idx_proyectos_responsable_id on proyectos (responsable_id);
create index if not exists idx_proyectos_fecha_entrega on proyectos (fecha_entrega);
create index if not exists idx_proyectos_updated_at on proyectos (updated_at desc);

-- ============================================================
-- 4. proyecto_enlaces — Drive, Figma, Vercel, Meta Ads…
-- ============================================================
create table if not exists proyecto_enlaces (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  url text not null check (url ~* '^https?://'),
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proyecto_enlaces_proyecto_id on proyecto_enlaces (proyecto_id);

-- ============================================================
-- 5. tareas — independientes de eventos (eventos = seguimientos CRM)
-- ============================================================
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text,
  proyecto_id uuid references proyectos(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  responsable_id uuid references usuarios(id) on delete set null default auth.uid(),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_progreso', 'esperando', 'completada')),
  prioridad text not null default 'normal'
    check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  fecha_limite date,
  -- Lo rellena el trigger. "Completada" se deriva de estado, no se duplica.
  completada_en timestamptz,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tareas_proyecto_id on tareas (proyecto_id);
create index if not exists idx_tareas_lead_id on tareas (lead_id);
create index if not exists idx_tareas_responsable_id on tareas (responsable_id);
create index if not exists idx_tareas_creado_por on tareas (creado_por);
create index if not exists idx_tareas_pendientes on tareas (fecha_limite) where estado <> 'completada';

-- ============================================================
-- 6. actividad — historial global, escrito solo por triggers
-- ============================================================
create table if not exists actividad (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references usuarios(id) on delete set null,
  entidad text not null,        -- 'proyecto' | 'tarea' | 'lead' | …
  entidad_id uuid,
  accion text not null,         -- 'creado' | 'estado' | 'completada' | 'archivado' | 'eliminado' | …
  titulo text,                  -- nombre de la entidad en el momento del cambio
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_actividad_created_at on actividad (created_at desc);
create index if not exists idx_actividad_entidad on actividad (entidad, entidad_id);

comment on table actividad is 'Historial global. Lo escriben triggers; base para automatizaciones futuras (webhooks/Edge Functions sobre inserciones).';

-- ============================================================
-- 7. Triggers: updated_at
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'marcas', 'proyectos', 'proyecto_enlaces', 'tareas'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', t);
    execute format('create trigger trg_%1$s_updated_at before update on %1$I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- 8. Triggers de coherencia (BEFORE)
-- ============================================================
create or replace function public.proyectos_antes_de_guardar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- La cuenta de un proyecto es siempre la de su marca: se deriva, no se elige dos veces.
  if new.marca_id is not null then
    select m.cuenta_id into new.cuenta_id from marcas m where m.id = new.marca_id;
  end if;

  if new.estado = 'entregado' and (tg_op = 'INSERT' or old.estado is distinct from 'entregado') then
    new.entregado_en := coalesce(new.entregado_en, now());
  elsif new.estado <> 'entregado' then
    new.entregado_en := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proyectos_antes_de_guardar on proyectos;
create trigger trg_proyectos_antes_de_guardar
  before insert or update on proyectos
  for each row execute function public.proyectos_antes_de_guardar();

create or replace function public.tareas_antes_de_guardar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'completada' and (tg_op = 'INSERT' or old.estado is distinct from 'completada') then
    new.completada_en := coalesce(new.completada_en, now());
  elsif new.estado <> 'completada' then
    new.completada_en := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tareas_antes_de_guardar on tareas;
create trigger trg_tareas_antes_de_guardar
  before insert or update on tareas
  for each row execute function public.tareas_antes_de_guardar();

-- ============================================================
-- 9. Triggers de actividad (AFTER). SECURITY DEFINER para poder escribir en
--    actividad (los usuarios no tienen política de INSERT). Cualquier error
--    se degrada a WARNING: registrar historial nunca bloquea la operación.
-- ============================================================
create or replace function public.registrar_actividad(
  p_entidad text, p_entidad_id uuid, p_accion text, p_titulo text, p_datos jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into actividad (actor_id, entidad, entidad_id, accion, titulo, datos)
  values (auth.uid(), p_entidad, p_entidad_id, p_accion, p_titulo, coalesce(p_datos, '{}'::jsonb));
exception when others then
  raise warning 'registrar_actividad(%, %): %', p_entidad, p_accion, sqlerrm;
end;
$$;

revoke execute on function public.registrar_actividad(text, uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.actividad_proyectos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad('proyecto', new.id, 'creado', new.nombre,
      jsonb_build_object('estado', new.estado, 'lead_id', new.lead_id));
  elsif tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      perform registrar_actividad('proyecto', new.id, 'estado', new.nombre,
        jsonb_build_object('de', old.estado, 'a', new.estado));
    end if;
    if new.archivado is distinct from old.archivado then
      perform registrar_actividad('proyecto', new.id, case when new.archivado then 'archivado' else 'restaurado' end, new.nombre);
    end if;
  elsif tg_op = 'DELETE' then
    perform registrar_actividad('proyecto', old.id, 'eliminado', old.nombre);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_proyectos on proyectos;
create trigger trg_actividad_proyectos
  after insert or update or delete on proyectos
  for each row execute function public.actividad_proyectos();

create or replace function public.actividad_tareas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad('tarea', new.id, 'creado', new.titulo,
      jsonb_build_object('proyecto_id', new.proyecto_id));
  elsif new.estado is distinct from old.estado then
    perform registrar_actividad('tarea', new.id,
      case when new.estado = 'completada' then 'completada' else 'estado' end,
      new.titulo,
      jsonb_build_object('de', old.estado, 'a', new.estado, 'proyecto_id', new.proyecto_id));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_tareas on tareas;
create trigger trg_actividad_tareas
  after insert or update on tareas
  for each row execute function public.actividad_tareas();

-- Leads: solo cambios de estado (las importaciones masivas no inundan el historial).
create or replace function public.actividad_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    perform registrar_actividad('lead', new.id, 'estado', coalesce(new.negocio, new.nombre_contacto),
      jsonb_build_object('de', old.estado, 'a', new.estado));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_leads on leads;
create trigger trg_actividad_leads
  after update on leads
  for each row execute function public.actividad_leads();

revoke execute on function public.proyectos_antes_de_guardar() from public, anon, authenticated;
revoke execute on function public.tareas_antes_de_guardar() from public, anon, authenticated;
revoke execute on function public.actividad_proyectos() from public, anon, authenticated;
revoke execute on function public.actividad_tareas() from public, anon, authenticated;
revoke execute on function public.actividad_leads() from public, anon, authenticated;

-- ============================================================
-- 10. RLS
-- ============================================================
alter table cuentas enable row level security;
alter table marcas enable row level security;
alter table proyectos enable row level security;
alter table proyecto_enlaces enable row level security;
alter table tareas enable row level security;
alter table actividad enable row level security;

-- Módulos de negocio: solo admin.
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'marcas', 'proyectos', 'proyecto_enlaces'] loop
    execute format('drop policy if exists "%1$s_admin" on %1$I', t);
    execute format(
      'create policy "%1$s_admin" on %1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "actividad_select_admin" on actividad;
create policy "actividad_select_admin" on actividad
  for select to authenticated
  using (public.is_admin());

-- Tareas
drop policy if exists "tareas_select" on tareas;
create policy "tareas_select" on tareas
  for select to authenticated
  using (public.is_admin() or responsable_id = auth.uid() or creado_por = auth.uid());

drop policy if exists "tareas_insert" on tareas;
create policy "tareas_insert" on tareas
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      creado_por = auth.uid()
      and responsable_id = auth.uid()
      and proyecto_id is null
      and (lead_id is null or exists (select 1 from leads l where l.id = lead_id and l.asignado_a = auth.uid()))
    )
  );

drop policy if exists "tareas_update" on tareas;
create policy "tareas_update" on tareas
  for update to authenticated
  using (public.is_admin() or responsable_id = auth.uid() or creado_por = auth.uid())
  with check (
    public.is_admin()
    or (
      (responsable_id = auth.uid() or creado_por = auth.uid())
      and (lead_id is null or exists (select 1 from leads l where l.id = lead_id and l.asignado_a = auth.uid()))
    )
  );

drop policy if exists "tareas_delete" on tareas;
create policy "tareas_delete" on tareas
  for delete to authenticated
  using (public.is_admin() or creado_por = auth.uid());
