-- ============================================================
-- 1. usuarios: vincular a Supabase Auth, añadir email + rol
-- ============================================================
-- ADVERTENCIA: este bloque borra los usuarios existentes porque en el
-- proyecto original no estaban vinculados a auth.users. Ejecútalo solo en
-- un proyecto nuevo, antes de tener leads/eventos/interacciones reales, o
-- adapta la migración de datos según corresponda.
delete from usuarios;

alter table usuarios
  add column if not exists email text,
  add column if not exists rol text;

alter table usuarios alter column id drop default;

alter table usuarios
  drop constraint if exists usuarios_id_fkey,
  add constraint usuarios_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table usuarios
  drop constraint if exists usuarios_email_key,
  add constraint usuarios_email_key unique (email);

alter table usuarios
  drop constraint if exists usuarios_rol_check,
  add constraint usuarios_rol_check check (rol in ('admin', 'comercial'));

alter table usuarios alter column email set not null;
alter table usuarios alter column rol set not null;

-- Inserta aquí las filas de Jaime/Laura/Reyes con los id reales de
-- auth.users una vez creadas sus cuentas (ver README, sección 2).
-- insert into usuarios (id, nombre, email, rol) values
--   ('<uuid-auth-jaime>', 'Jaime', 'jaime@ejemplo.com', 'admin'),
--   ('<uuid-auth-laura>', 'Laura', 'laura@ejemplo.com', 'comercial'),
--   ('<uuid-auth-reyes>', 'Reyes', 'reyes@ejemplo.com', 'comercial');

-- ============================================================
-- 2. Auto-provisión: cualquier auth.users nuevo (creado vía Admin API)
--    obtiene automáticamente su fila en usuarios.
-- ============================================================
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
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'comercial')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. Helper is_admin() — SECURITY DEFINER evita recursión de RLS
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios where id = auth.uid() and rol = 'admin'
  );
$$;

-- ============================================================
-- 4. Políticas RLS reales (sustituyen a las permisivas "for all using (true)")
-- ============================================================
drop policy if exists "usuarios_all" on usuarios;
drop policy if exists "leads_all" on leads;
drop policy if exists "interacciones_all" on interacciones;
drop policy if exists "eventos_all" on eventos;

-- usuarios: lectura para cualquier autenticado (necesario para nombres/avatares en UI)
drop policy if exists "usuarios_select_authenticated" on usuarios;
create policy "usuarios_select_authenticated" on usuarios
  for select to authenticated
  using (true);

-- leads
drop policy if exists "leads_select" on leads;
create policy "leads_select" on leads
  for select to authenticated
  using (public.is_admin() or asignado_a = auth.uid());

drop policy if exists "leads_insert" on leads;
create policy "leads_insert" on leads
  for insert to authenticated
  with check (public.is_admin() or asignado_a = auth.uid());

drop policy if exists "leads_update" on leads;
create policy "leads_update" on leads
  for update to authenticated
  using (public.is_admin() or asignado_a = auth.uid())
  with check (public.is_admin() or asignado_a = auth.uid());

-- eventos
drop policy if exists "eventos_select" on eventos;
create policy "eventos_select" on eventos
  for select to authenticated
  using (
    public.is_admin()
    or usuario_id = auth.uid()
    or exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
  );

drop policy if exists "eventos_insert" on eventos;
create policy "eventos_insert" on eventos
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
  );

drop policy if exists "eventos_update" on eventos;
create policy "eventos_update" on eventos
  for update to authenticated
  using (
    public.is_admin()
    or usuario_id = auth.uid()
    or exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
  )
  with check (
    public.is_admin()
    or usuario_id = auth.uid()
    or exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
  );

-- interacciones
drop policy if exists "interacciones_select" on interacciones;
create policy "interacciones_select" on interacciones
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from leads l where l.id = interacciones.lead_id and l.asignado_a = auth.uid())
  );

drop policy if exists "interacciones_insert" on interacciones;
create policy "interacciones_insert" on interacciones
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from leads l where l.id = interacciones.lead_id and l.asignado_a = auth.uid())
  );
