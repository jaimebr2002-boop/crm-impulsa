-- Company OS — Fase 2 (Operaciones).
--
-- Añade, sin borrar ni reescribir datos:
--   1. Subproyectos de un nivel (proyectos.proyecto_padre_id).
--   2. Eventos genéricos en la tabla eventos existente (reuniones y eventos
--      manuales, con lead opcional y enlace a proyecto/cuenta), para que el
--      calendario unificado no duplique datos en otra tabla.
--   3. Actividad contextualizada: actividad.cuenta_id y actividad.proyecto_id
--      (feeds por cuenta/proyecto eficientes y base para Finanzas), textos más
--      ricos y registro de cuentas, marcas y reuniones.
-- Idempotente: puede ejecutarse varias veces.

-- ============================================================
-- 1. Subproyectos (un solo nivel: Campaña → Vídeo 1, Vídeo 2…)
-- ============================================================
alter table proyectos
  add column if not exists proyecto_padre_id uuid references proyectos(id) on delete set null;

create index if not exists idx_proyectos_padre on proyectos (proyecto_padre_id) where proyecto_padre_id is not null;

comment on column proyectos.proyecto_padre_id is
  'Proyecto contenedor (p. ej. una campaña). Un solo nivel: un subproyecto no puede tener subproyectos. Borrar el padre deja los hijos como proyectos sueltos.';

create or replace function public.proyectos_jerarquia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  padre record;
begin
  if new.proyecto_padre_id is null then
    return new;
  end if;
  if new.proyecto_padre_id = new.id then
    raise exception 'Un proyecto no puede ser subproyecto de sí mismo.';
  end if;

  select id, proyecto_padre_id, cuenta_id, marca_id into padre from proyectos where id = new.proyecto_padre_id;
  if not found then
    raise exception 'El proyecto padre no existe.';
  end if;
  if padre.proyecto_padre_id is not null then
    raise exception 'Solo se permite un nivel de subproyectos.';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from proyectos h where h.proyecto_padre_id = new.id) then
    raise exception 'Este proyecto ya tiene subproyectos: no puede ser a su vez subproyecto.';
  end if;

  -- Hereda cuenta y marca del padre si no se indican.
  if new.marca_id is null and new.cuenta_id is null then
    new.marca_id := padre.marca_id;
    new.cuenta_id := padre.cuenta_id;
  elsif new.cuenta_id is null then
    new.cuenta_id := padre.cuenta_id;
  end if;
  return new;
end;
$$;

-- El nombre ordena este trigger después de trg_proyectos_antes_de_guardar
-- (que deriva la cuenta desde la marca).
drop trigger if exists trg_proyectos_jerarquia on proyectos;
create trigger trg_proyectos_jerarquia
  before insert or update of proyecto_padre_id, cuenta_id, marca_id on proyectos
  for each row execute function public.proyectos_jerarquia();

revoke execute on function public.proyectos_jerarquia() from public, anon, authenticated;

-- Si una marca cambia de cuenta, sus proyectos la acompañan (la cuenta de un
-- proyecto con marca es siempre la de su marca).
create or replace function public.marcas_propagar_cuenta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cuenta_id is distinct from old.cuenta_id then
    update proyectos set cuenta_id = new.cuenta_id where marca_id = new.id and cuenta_id is distinct from new.cuenta_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_marcas_propagar_cuenta on marcas;
create trigger trg_marcas_propagar_cuenta
  after update of cuenta_id on marcas
  for each row execute function public.marcas_propagar_cuenta();

revoke execute on function public.marcas_propagar_cuenta() from public, anon, authenticated;

-- ============================================================
-- 2. Eventos genéricos (reuniones, eventos manuales)
-- ============================================================
alter table eventos add column if not exists tipo text not null default 'seguimiento';
alter table eventos add column if not exists descripcion text;
alter table eventos add column if not exists proyecto_id uuid references proyectos(id) on delete set null;
alter table eventos add column if not exists cuenta_id uuid references cuentas(id) on delete set null;
alter table eventos alter column lead_id drop not null;

alter table eventos drop constraint if exists eventos_tipo_check;
alter table eventos add constraint eventos_tipo_check check (tipo in ('seguimiento', 'reunion', 'evento'));
-- Un seguimiento CRM siempre pertenece a un lead (todos los eventos existentes lo cumplen).
alter table eventos drop constraint if exists eventos_seguimiento_con_lead;
alter table eventos add constraint eventos_seguimiento_con_lead check (tipo <> 'seguimiento' or lead_id is not null);

create index if not exists idx_eventos_proyecto_id on eventos (proyecto_id) where proyecto_id is not null;
create index if not exists idx_eventos_cuenta_id on eventos (cuenta_id) where cuenta_id is not null;

comment on column eventos.tipo is 'seguimiento (CRM, con lead) | reunion | evento. Todos se muestran en el calendario unificado.';

-- Políticas: se reescriben las de 0002 con UNA restricción añadida para
-- comerciales: no pueden ligar eventos a proyectos ni cuentas (módulos solo
-- admin). Sin lead, un comercial tampoco puede crear eventos (igual que antes).
drop policy if exists "eventos_insert" on eventos;
create policy "eventos_insert" on eventos
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      proyecto_id is null and cuenta_id is null
      and exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
    )
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
    or (
      proyecto_id is null and cuenta_id is null
      and (
        usuario_id = auth.uid()
        or exists (select 1 from leads l where l.id = eventos.lead_id and l.asignado_a = auth.uid())
      )
    )
  );

-- Borrar reuniones/eventos: solo admin (los seguimientos siguen sin borrado, como hasta ahora).
drop policy if exists "eventos_delete" on eventos;
create policy "eventos_delete" on eventos
  for delete to authenticated
  using (public.is_admin() and tipo <> 'seguimiento');

-- ============================================================
-- 3. Actividad con contexto de cuenta y proyecto
-- ============================================================
alter table actividad add column if not exists cuenta_id uuid references cuentas(id) on delete set null;
alter table actividad add column if not exists proyecto_id uuid references proyectos(id) on delete set null;

create index if not exists idx_actividad_cuenta on actividad (cuenta_id, created_at desc) where cuenta_id is not null;
create index if not exists idx_actividad_proyecto on actividad (proyecto_id, created_at desc) where proyecto_id is not null;

-- Rellena el contexto de la actividad ya registrada (solo filas sin rellenar).
update actividad a set proyecto_id = p.id
from proyectos p
where a.proyecto_id is null and a.entidad = 'proyecto' and a.entidad_id = p.id;

update actividad a set proyecto_id = p.id
from proyectos p
where a.proyecto_id is null and a.entidad = 'tarea'
  and a.datos->>'proyecto_id' is not null and p.id::text = a.datos->>'proyecto_id';

update actividad a set cuenta_id = p.cuenta_id
from proyectos p
where a.cuenta_id is null and a.proyecto_id = p.id and p.cuenta_id is not null;

update actividad a set cuenta_id = c.id
from cuentas c
where a.cuenta_id is null and a.entidad = 'lead' and c.lead_id = a.entidad_id;

create or replace function public.registrar_actividad_ctx(
  p_entidad text, p_entidad_id uuid, p_accion text, p_titulo text, p_datos jsonb,
  p_cuenta_id uuid, p_proyecto_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into actividad (actor_id, entidad, entidad_id, accion, titulo, datos, cuenta_id, proyecto_id)
  values (auth.uid(), p_entidad, p_entidad_id, p_accion, p_titulo, coalesce(p_datos, '{}'::jsonb), p_cuenta_id, p_proyecto_id);
exception when others then
  raise warning 'registrar_actividad_ctx(%, %): %', p_entidad, p_accion, sqlerrm;
end;
$$;

revoke execute on function public.registrar_actividad_ctx(text, uuid, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

-- Proyectos
create or replace function public.actividad_proyectos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead text;
begin
  if tg_op = 'INSERT' then
    if new.lead_id is not null then
      select coalesce(negocio, nombre_contacto) into v_lead from leads where id = new.lead_id;
    end if;
    perform registrar_actividad_ctx('proyecto', new.id, 'creado', new.nombre,
      jsonb_build_object('estado', new.estado, 'lead_id', new.lead_id, 'lead_nombre', v_lead,
                         'padre_id', new.proyecto_padre_id),
      new.cuenta_id, new.id);
  elsif tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      perform registrar_actividad_ctx('proyecto', new.id, 'estado', new.nombre,
        jsonb_build_object('de', old.estado, 'a', new.estado), new.cuenta_id, new.id);
    end if;
    if new.archivado is distinct from old.archivado then
      perform registrar_actividad_ctx('proyecto', new.id,
        case when new.archivado then 'archivado' else 'restaurado' end, new.nombre, '{}'::jsonb, new.cuenta_id, new.id);
    end if;
  elsif tg_op = 'DELETE' then
    -- El proyecto ya no existe: se guarda su id en entidad_id, sin FK.
    perform registrar_actividad_ctx('proyecto', old.id, 'eliminado', old.nombre, '{}'::jsonb, old.cuenta_id, null);
  end if;
  return null;
end;
$$;

-- Tareas
create or replace function public.actividad_tareas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta uuid;
  v_proyecto text;
begin
  if new.proyecto_id is not null then
    select cuenta_id, nombre into v_cuenta, v_proyecto from proyectos where id = new.proyecto_id;
  end if;
  if tg_op = 'INSERT' then
    perform registrar_actividad_ctx('tarea', new.id, 'creado', new.titulo,
      jsonb_build_object('proyecto_id', new.proyecto_id, 'proyecto_nombre', v_proyecto),
      v_cuenta, new.proyecto_id);
  elsif new.estado is distinct from old.estado then
    perform registrar_actividad_ctx('tarea', new.id,
      case when new.estado = 'completada' then 'completada' else 'estado' end,
      new.titulo,
      jsonb_build_object('de', old.estado, 'a', new.estado, 'proyecto_id', new.proyecto_id, 'proyecto_nombre', v_proyecto),
      v_cuenta, new.proyecto_id);
  end if;
  return null;
end;
$$;

-- Leads (solo cambios de estado; si el lead ya es cuenta, se enlaza a ella)
create or replace function public.actividad_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta uuid;
begin
  if new.estado is distinct from old.estado then
    select id into v_cuenta from cuentas where lead_id = new.id;
    perform registrar_actividad_ctx('lead', new.id, 'estado', coalesce(new.negocio, new.nombre_contacto),
      jsonb_build_object('de', old.estado, 'a', new.estado), v_cuenta, null);
  end if;
  return null;
end;
$$;

-- Cuentas
create or replace function public.actividad_cuentas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad_ctx('cuenta', new.id, 'creado', new.nombre,
      jsonb_build_object('tipo', new.tipo, 'lead_id', new.lead_id), new.id, null);
  elsif new.archivada is distinct from old.archivada then
    perform registrar_actividad_ctx('cuenta', new.id,
      case when new.archivada then 'archivado' else 'restaurado' end, new.nombre, '{}'::jsonb, new.id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_cuentas on cuentas;
create trigger trg_actividad_cuentas
  after insert or update on cuentas
  for each row execute function public.actividad_cuentas();

-- Marcas
create or replace function public.actividad_marcas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta text;
begin
  select nombre into v_cuenta from cuentas where id = new.cuenta_id;
  perform registrar_actividad_ctx('marca', new.id, 'creado', new.nombre,
    jsonb_build_object('cuenta_nombre', v_cuenta), new.cuenta_id, null);
  return null;
end;
$$;

drop trigger if exists trg_actividad_marcas on marcas;
create trigger trg_actividad_marcas
  after insert on marcas
  for each row execute function public.actividad_marcas();

-- Reuniones y eventos manuales (los seguimientos CRM no se registran: serían ruido)
create or replace function public.actividad_eventos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo <> 'seguimiento' then
    perform registrar_actividad_ctx('evento', new.id, 'creado', new.titulo,
      jsonb_build_object('tipo', new.tipo, 'fecha_hora', new.fecha_hora), new.cuenta_id, new.proyecto_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_eventos on eventos;
create trigger trg_actividad_eventos
  after insert on eventos
  for each row execute function public.actividad_eventos();

revoke execute on function public.actividad_cuentas() from public, anon, authenticated;
revoke execute on function public.actividad_marcas() from public, anon, authenticated;
revoke execute on function public.actividad_eventos() from public, anon, authenticated;
