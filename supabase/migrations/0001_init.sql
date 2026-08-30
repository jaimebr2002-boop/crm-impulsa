-- CRM Impulsa Studio — esquema inicial
-- Reproducible: puede ejecutarse en un proyecto Supabase nuevo sin pasos manuales adicionales.

create extension if not exists "pgcrypto";

-- ============================================================
-- Tabla: usuarios
-- ============================================================
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
);

-- ============================================================
-- Tabla: leads
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nombre_contacto text,
  negocio text,
  telefono text,
  nicho text,
  ciudad text,
  canal text,
  referido_por text,
  origen text,
  segmento text,
  oferta text,
  estado text default 'pendiente',
  proximo_contacto timestamptz,
  asignado_a uuid references usuarios(id),
  -- Campos ampliados para conservar datos de la campaña histórica de reactivación.
  email text,
  enlace_demo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column leads.email is 'Email del lead, procedente de la campaña histórica de reactivación u otras fuentes.';
comment on column leads.enlace_demo is 'Enlace a la demo mostrada al lead, procedente de la campaña histórica de reactivación.';

-- ============================================================
-- Tabla: interacciones (notas + resultados de llamada)
-- ============================================================
create table if not exists interacciones (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  fecha timestamptz default now(),
  canal text,
  resultado text,
  nota text
);

-- ============================================================
-- Tabla: eventos (calendario / seguimientos)
-- ============================================================
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  titulo text not null,
  fecha_hora timestamptz not null,
  completada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Índices — accesos principales de la aplicación
-- ============================================================
create index if not exists idx_leads_asignado_a on leads (asignado_a);
create index if not exists idx_leads_estado on leads (estado);
create index if not exists idx_leads_origen on leads (origen);
create index if not exists idx_leads_segmento on leads (segmento);
create index if not exists idx_leads_updated_at on leads (updated_at desc);

create index if not exists idx_eventos_usuario_id on eventos (usuario_id);
create index if not exists idx_eventos_fecha_hora on eventos (fecha_hora);
create index if not exists idx_eventos_lead_id on eventos (lead_id);

create index if not exists idx_interacciones_lead_id on interacciones (lead_id);

-- ============================================================
-- Triggers: updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
  before update on leads
  for each row
  execute function set_updated_at();

drop trigger if exists trg_eventos_updated_at on eventos;
create trigger trg_eventos_updated_at
  before update on eventos
  for each row
  execute function set_updated_at();

-- ============================================================
-- RLS — no existe autenticación tradicional (identificación local
-- por dispositivo). La app es interna y de confianza para 3 personas.
-- Se habilita RLS con políticas permisivas para el rol anon/authenticated
-- en vez de dejar las tablas sin RLS.
-- ============================================================
alter table usuarios enable row level security;
alter table leads enable row level security;
alter table interacciones enable row level security;
alter table eventos enable row level security;

drop policy if exists "usuarios_all" on usuarios;
create policy "usuarios_all" on usuarios for all using (true) with check (true);

drop policy if exists "leads_all" on leads;
create policy "leads_all" on leads for all using (true) with check (true);

drop policy if exists "interacciones_all" on interacciones;
create policy "interacciones_all" on interacciones for all using (true) with check (true);

drop policy if exists "eventos_all" on eventos;
create policy "eventos_all" on eventos for all using (true) with check (true);
