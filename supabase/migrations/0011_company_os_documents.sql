-- ============================================================
-- 0011 · Company OS — Documentos (Fase 4)
-- ============================================================
-- · documentos: metadatos de los archivos (el binario vive en Supabase Storage,
--   bucket privado "documentos"; nunca en PostgreSQL).
-- · ajustes_facturacion: datos del emisor y preferencias (IVA/IRPF por defecto).
-- · cuentas: datos fiscales opcionales del receptor.
-- · facturas: huella del PDF generado para detectar PDFs desactualizados.
-- · proyectos_facturacion: separa lo facturado (emitido) de lo que está en borrador.
-- · Storage: bucket privado con límites de tamaño/MIME y políticas solo admin.
--
-- No destructiva y re-ejecutable. Solo se re-crean dos VISTAS (sin datos).
-- Depende de 0008 (is_admin, set_updated_at), 0009 (registrar_actividad_ctx) y 0010.
-- ============================================================

-- ============================================================
-- 1. Datos de facturación del emisor + preferencias (fila única)
-- ============================================================
create table if not exists ajustes_facturacion (
  id boolean primary key default true check (id),
  -- Persona física o sociedad: basta con "nombre" (nombre completo o razón social).
  nombre text check (nombre is null or length(nombre) <= 200),
  nif text check (nif is null or length(nif) <= 20),
  direccion text check (direccion is null or length(direccion) <= 300),
  codigo_postal text check (codigo_postal is null or length(codigo_postal) <= 12),
  ciudad text check (ciudad is null or length(ciudad) <= 100),
  provincia text check (provincia is null or length(provincia) <= 100),
  pais text not null default 'España' check (length(pais) <= 100),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text check (telefono is null or length(telefono) <= 30),
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$'),
  -- Texto al pie del PDF (p. ej. exenciones de IVA, forma de pago, registro).
  texto_legal text check (texto_legal is null or length(texto_legal) <= 1000),
  iva_pct_defecto numeric(5, 2) not null default 21 check (iva_pct_defecto between 0 and 100),
  irpf_pct_defecto numeric(5, 2) not null default 7 check (irpf_pct_defecto between 0 and 100),
  dias_vencimiento int not null default 30 check (dias_vencimiento between 0 and 365),
  updated_at timestamptz not null default now()
);

insert into ajustes_facturacion (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_ajustes_facturacion_updated_at on ajustes_facturacion;
create trigger trg_ajustes_facturacion_updated_at
  before update on ajustes_facturacion
  for each row execute function set_updated_at();

comment on table ajustes_facturacion is 'Fila única con los datos fiscales del emisor (salen en los PDF) y preferencias de facturación.';

-- ============================================================
-- 2. Datos fiscales opcionales del receptor (cuentas)
-- ============================================================
alter table cuentas add column if not exists fiscal_nombre text;
alter table cuentas add column if not exists fiscal_nif text;
alter table cuentas add column if not exists fiscal_direccion text;
alter table cuentas add column if not exists fiscal_codigo_postal text;
alter table cuentas add column if not exists fiscal_ciudad text;
alter table cuentas add column if not exists fiscal_provincia text;
alter table cuentas add column if not exists fiscal_pais text;
alter table cuentas add column if not exists email_facturacion text;

do $$ begin
  alter table cuentas add constraint cuentas_fiscal_longitudes check (
    coalesce(length(fiscal_nombre), 0) <= 200 and coalesce(length(fiscal_nif), 0) <= 20
    and coalesce(length(fiscal_direccion), 0) <= 300 and coalesce(length(fiscal_codigo_postal), 0) <= 12
    and coalesce(length(fiscal_ciudad), 0) <= 100 and coalesce(length(fiscal_provincia), 0) <= 100
    and coalesce(length(fiscal_pais), 0) <= 100
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table cuentas add constraint cuentas_email_facturacion_valido
    check (email_facturacion is null or email_facturacion ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 3. Documentos
-- ============================================================
-- Tipos admitidos. La misma lista está en el bucket (allowed_mime_types) y en
-- src/lib/documentos.ts, que además comprueba la firma real del archivo.
create or replace function public.documento_mime_permitido(p_mime text)
returns boolean
language sql
immutable
as $$
  select p_mime = any (array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/plain', 'text/markdown', 'text/csv',
    'application/zip',
    'video/mp4', 'video/quicktime'
  ])
$$;

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  -- Nombre visible ("Brief Segurma") y nombre original del archivo ("brief-segurma.pdf").
  nombre text not null check (length(trim(nombre)) between 1 and 200),
  nombre_archivo text not null check (length(nombre_archivo) between 1 and 255),
  -- Ruta dentro del bucket: {id}/{archivo}. Única: dos filas nunca comparten objeto.
  storage_path text not null unique
    check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'),
  mime_type text not null check (public.documento_mime_permitido(mime_type)),
  -- 50 MB, igual que el límite del bucket.
  tamano bigint not null check (tamano between 0 and 52428800),
  categoria text not null default 'otro' check (categoria in (
    'factura', 'justificante', 'contrato', 'propuesta', 'briefing',
    'informe', 'guion', 'creativo', 'recurso', 'otro'
  )),
  descripcion text check (descripcion is null or length(descripcion) <= 2000),
  -- Una relación directa como máximo. La cuenta/marca/proyecto "de contexto" se
  -- deduce en la vista documentos_contexto (un PDF de factura pertenece a Fer
  -- a través de la factura; no se duplica la cuenta aquí).
  cuenta_id uuid references cuentas(id) on delete set null,
  marca_id uuid references marcas(id) on delete set null,
  proyecto_id uuid references proyectos(id) on delete set null,
  factura_id uuid references facturas(id) on delete set null,
  gasto_id uuid references gastos(id) on delete set null,
  -- 'generado' = PDF de factura creado por la app (su actividad es "generó el PDF").
  origen text not null default 'subida' check (origen in ('subida', 'generado')),
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentos_una_relacion check (num_nonnulls(cuenta_id, marca_id, proyecto_id, factura_id, gasto_id) <= 1),
  -- El id forma parte de la ruta: así un objeto huérfano se identifica sin ambigüedad.
  constraint documentos_ruta_con_id check (split_part(storage_path, '/', 1) = id::text)
);

create index if not exists idx_documentos_created_at on documentos (created_at desc);
create index if not exists idx_documentos_categoria on documentos (categoria);
create index if not exists idx_documentos_cuenta on documentos (cuenta_id) where cuenta_id is not null;
create index if not exists idx_documentos_marca on documentos (marca_id) where marca_id is not null;
create index if not exists idx_documentos_proyecto on documentos (proyecto_id) where proyecto_id is not null;
create index if not exists idx_documentos_factura on documentos (factura_id) where factura_id is not null;
create index if not exists idx_documentos_gasto on documentos (gasto_id) where gasto_id is not null;

drop trigger if exists trg_documentos_updated_at on documentos;
create trigger trg_documentos_updated_at
  before update on documentos
  for each row execute function set_updated_at();

comment on table documentos is 'Metadatos de archivos. El binario está en Storage (bucket documentos) en storage_path.';
comment on column gastos.justificante_path is 'Ruta del justificante más reciente (documentos.categoria = justificante). La mantiene un trigger de documentos.';

-- Contexto deducido: cuenta, marca y proyecto a los que pertenece cada documento,
-- directa o indirectamente (proyecto → marca → cuenta, factura → cuenta, gasto → proyecto).
create or replace view documentos_contexto with (security_invoker = true) as
select
  d.*,
  coalesce(d.cuenta_id, m.cuenta_id, p.cuenta_id, f.cuenta_id, g.cuenta_id, gp.cuenta_id) as ref_cuenta_id,
  coalesce(d.marca_id, p.marca_id, gp.marca_id) as ref_marca_id,
  coalesce(d.proyecto_id, g.proyecto_id) as ref_proyecto_id,
  c.nombre as cuenta_nombre,
  mc.nombre as marca_nombre,
  coalesce(p.nombre, gp.nombre) as proyecto_nombre,
  f.numero as factura_numero,
  g.concepto as gasto_concepto
from documentos d
left join marcas m on m.id = d.marca_id
left join proyectos p on p.id = d.proyecto_id
left join facturas f on f.id = d.factura_id
left join gastos g on g.id = d.gasto_id
left join proyectos gp on gp.id = g.proyecto_id
left join cuentas c on c.id = coalesce(d.cuenta_id, m.cuenta_id, p.cuenta_id, f.cuenta_id, g.cuenta_id, gp.cuenta_id)
left join marcas mc on mc.id = coalesce(d.marca_id, p.marca_id, gp.marca_id);

comment on view documentos_contexto is 'Documentos con su cuenta/marca/proyecto deducidos y nombres para mostrar y buscar.';

-- ============================================================
-- 4. Facturas: huella del PDF y estado del PDF
-- ============================================================
alter table facturas add column if not exists pdf_huella text;
alter table facturas add column if not exists pdf_generado_en timestamptz;

-- Huella de todo lo que sale impreso en el PDF y pertenece a la factura
-- (número, fechas, estado, receptor, porcentajes, totales y líneas).
-- Si cambia algo de eso después de generar el PDF, la huella deja de coincidir.
create or replace function public.factura_huella(p_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select md5(concat_ws('|',
    f.numero, f.estado, f.fecha_emision, f.fecha_vencimiento, f.cuenta_id,
    f.iva_pct, f.irpf_pct, f.base, f.iva, f.irpf, f.total, f.moneda,
    (select string_agg(concat_ws('~', l.orden, l.descripcion, l.cantidad, l.precio_unitario, l.importe), '¶' order by l.orden, l.id)
       from factura_lineas l where l.factura_id = f.id)
  ))
  from facturas f
  where f.id = p_id
$$;

-- Re-crear las vistas de 0010 (añaden columnas; "create or replace" no permite
-- reordenar las de f.*). Son vistas: no hay datos que perder.
drop view if exists proyectos_facturacion;
drop view if exists facturas_estado;

create view facturas_estado with (security_invoker = true) as
select
  f.*,
  coalesce(c.cobrado, 0)::numeric(12, 2) as cobrado,
  (f.total - coalesce(c.cobrado, 0))::numeric(12, 2) as pendiente,
  case
    when f.estado = 'borrador' then 'borrador'
    when f.estado = 'cancelada' then 'cancelada'
    when coalesce(c.cobrado, 0) >= f.total then 'cobrada'
    when coalesce(c.cobrado, 0) > 0 then 'parcial'
    when f.fecha_vencimiento is not null and f.fecha_vencimiento < current_date then 'vencida'
    else 'pendiente'
  end as estado_cobro,
  (f.estado = 'emitida' and coalesce(c.cobrado, 0) < f.total
    and f.fecha_vencimiento is not null and f.fecha_vencimiento < current_date) as vencida,
  c.ultimo_cobro,
  case
    when f.pdf_path is null then 'sin_pdf'
    when f.pdf_huella is distinct from public.factura_huella(f.id) then 'desactualizado'
    else 'actualizado'
  end as pdf_estado
from facturas f
left join (
  select factura_id, sum(importe) as cobrado, max(fecha) as ultimo_cobro
  from cobros
  group by factura_id
) c on c.factura_id = f.id;

comment on view facturas_estado is 'Factura + cobrado, pendiente, estado de cobro y estado del PDF. Leer siempre de aquí.';

-- Facturación por proyecto (base, sin IVA).
-- · facturado / cobrado: solo facturas EMITIDAS (definición de Fase 3, sin cambios).
-- · en_borrador: líneas en facturas BORRADOR. No cuenta como facturado; sirve
--   para no volver a ofrecer "Facturar" algo que ya está preparado.
create view proyectos_facturacion with (security_invoker = true) as
select
  l.proyecto_id,
  (count(distinct l.factura_id) filter (where fe.estado = 'emitida'))::int as facturas,
  coalesce(sum(l.importe) filter (where fe.estado = 'emitida'), 0)::numeric(12, 2) as facturado,
  coalesce(sum(
    case when fe.total > 0 then round(l.importe * least(fe.cobrado / fe.total, 1), 2) else 0 end
  ) filter (where fe.estado = 'emitida'), 0)::numeric(12, 2) as cobrado,
  coalesce(sum(l.importe) filter (where fe.estado = 'borrador'), 0)::numeric(12, 2) as en_borrador,
  coalesce(array_agg(distinct l.factura_id) filter (where fe.estado = 'borrador'), '{}') as borradores
from factura_lineas l
join facturas_estado fe on fe.id = l.factura_id
where l.proyecto_id is not null and fe.estado in ('emitida', 'borrador')
group by l.proyecto_id;

-- ============================================================
-- 5. Triggers de documentos
-- ============================================================
-- Mantiene gastos.justificante_path (justificante más reciente) y limpia
-- facturas.pdf_path si se borra el documento del PDF.
create or replace function public.documentos_sincronizar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_gasto uuid;
begin
  foreach v_gasto in array array[
    case when tg_op <> 'INSERT' then old.gasto_id end,
    case when tg_op <> 'DELETE' then new.gasto_id end
  ] loop
    if v_gasto is not null then
      update gastos set justificante_path = (
        select d.storage_path from documentos d
        where d.gasto_id = v_gasto and d.categoria = 'justificante'
        order by d.created_at desc limit 1
      ) where id = v_gasto;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    update facturas set pdf_path = null, pdf_huella = null, pdf_generado_en = null
    where pdf_path = old.storage_path;
  elsif tg_op = 'UPDATE' and new.storage_path is distinct from old.storage_path then
    update facturas set pdf_path = new.storage_path where pdf_path = old.storage_path;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_documentos_sincronizar on documentos;
create trigger trg_documentos_sincronizar
  after insert or update or delete on documentos
  for each row execute function public.documentos_sincronizar();

-- Actividad: subir, adjuntar justificante, eliminar. No se registra abrir ni
-- descargar (ruido) ni los PDF generados (los registra registrar_pdf_factura).
create or replace function public.actividad_documentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_doc documentos%rowtype;
  v_accion text;
begin
  if tg_op = 'DELETE' then
    v_doc := old;
    -- La fila ya no existe: el contexto se calcula a partir de sus relaciones.
    select
      coalesce(v_doc.cuenta_id, m.cuenta_id, p.cuenta_id, f.cuenta_id, g.cuenta_id) as ref_cuenta_id,
      coalesce(v_doc.proyecto_id, g.proyecto_id) as ref_proyecto_id,
      p.nombre as proyecto_nombre, f.numero as factura_numero, g.concepto as gasto_concepto
    into r
    from (select 1) x
    left join marcas m on m.id = v_doc.marca_id
    left join proyectos p on p.id = v_doc.proyecto_id
    left join facturas f on f.id = v_doc.factura_id
    left join gastos g on g.id = v_doc.gasto_id;
    v_accion := 'eliminado';
  else
    v_doc := new;
    if v_doc.origen = 'generado' then
      return null;
    end if;
    select * into r from documentos_contexto where id = v_doc.id;
    v_accion := case when v_doc.gasto_id is not null and v_doc.categoria = 'justificante' then 'justificante' else 'subido' end;
  end if;

  perform registrar_actividad_ctx('documento', v_doc.id, v_accion, v_doc.nombre,
    jsonb_build_object(
      'nombre_archivo', v_doc.nombre_archivo,
      'categoria', v_doc.categoria,
      'proyecto_nombre', r.proyecto_nombre,
      'factura_id', v_doc.factura_id,
      'factura_numero', r.factura_numero,
      'gasto_id', v_doc.gasto_id,
      'gasto_concepto', r.gasto_concepto,
      'marca_id', v_doc.marca_id,
      'directo_cuenta', v_doc.cuenta_id is not null
    ),
    r.ref_cuenta_id, r.ref_proyecto_id);
  return null;
end;
$$;

drop trigger if exists trg_actividad_documentos on documentos;
create trigger trg_actividad_documentos
  after insert or delete on documentos
  for each row execute function public.actividad_documentos();

-- ============================================================
-- 6. RPC: registrar el PDF generado de una factura (una transacción)
-- ============================================================
-- La ruta /api/facturas/[id]/pdf sube el PDF a Storage y después llama aquí:
-- crea o actualiza el documento, guarda pdf_path + huella y registra actividad.
create or replace function public.registrar_pdf_factura(
  p_factura_id uuid, p_documento_id uuid, p_storage_path text, p_tamano bigint
)
returns uuid
language plpgsql
security definer  -- para registrar actividad; el acceso se comprueba con is_admin()
set search_path = public
as $$
declare
  f facturas%rowtype;
  v_regenerado boolean;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  select * into f from facturas where id = p_factura_id for update;
  if not found then
    raise exception 'Factura no encontrada.';
  end if;
  if f.estado = 'borrador' then
    raise exception 'Emite la factura antes de generar el PDF.';
  end if;
  v_regenerado := f.pdf_path is not null;

  insert into documentos (id, nombre, nombre_archivo, storage_path, mime_type, tamano, categoria, factura_id, origen)
  values (p_documento_id, 'Factura ' || f.numero, 'factura-' || f.numero || '.pdf', p_storage_path,
          'application/pdf', p_tamano, 'factura', f.id, 'generado')
  on conflict (id) do update set
    nombre = excluded.nombre,
    nombre_archivo = excluded.nombre_archivo,
    storage_path = excluded.storage_path,
    tamano = excluded.tamano;

  update facturas
  set pdf_path = p_storage_path, pdf_huella = public.factura_huella(f.id), pdf_generado_en = now()
  where id = f.id;

  perform registrar_actividad_ctx('factura', f.id, 'pdf', f.numero,
    jsonb_build_object('numero', f.numero, 'regenerado', v_regenerado), f.cuenta_id, null);
  return p_documento_id;
end;
$$;

-- Rutas en Storage que no tienen fila en documentos (p. ej. si una subida se
-- cortó entre el archivo y el registro). Configuración permite limpiarlas.
create or replace function public.documentos_objetos_huerfanos()
returns table (name text, created_at timestamptz)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  return query
    select o.name, o.created_at
    from storage.objects o
    where o.bucket_id = 'documentos'
      and not exists (select 1 from documentos d where d.storage_path = o.name)
      -- Margen para subidas en curso (archivo subido, fila a punto de crearse).
      and o.created_at < now() - interval '10 minutes'
    order by o.created_at;
end;
$$;

-- ============================================================
-- 7. RLS (solo admin) y permisos de funciones
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['documentos', 'ajustes_facturacion'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%1$s_admin" on %1$I', t);
    execute format(
      'create policy "%1$s_admin" on %1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke execute on function public.registrar_pdf_factura(uuid, uuid, text, bigint) from public, anon;
grant execute on function public.registrar_pdf_factura(uuid, uuid, text, bigint) to authenticated;
revoke execute on function public.documentos_objetos_huerfanos() from public, anon;
grant execute on function public.documentos_objetos_huerfanos() to authenticated;
revoke execute on function public.documentos_sincronizar() from public, anon, authenticated;
revoke execute on function public.actividad_documentos() from public, anon, authenticated;

-- ============================================================
-- 8. Supabase Storage: bucket privado + políticas solo admin
-- ============================================================
-- public = false: no existe URL pública. Solo se accede con sesión (admin) o
-- con signed URLs de corta duración que crea la app para un admin.
-- file_size_limit / allowed_mime_types: Storage rechaza en el servidor lo que
-- se salte la validación del navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 52428800, array[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain', 'text/markdown', 'text/csv',
  'application/zip',
  'video/mp4', 'video/quicktime'
])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas sobre storage.objects. Si el rol que ejecuta la migración no puede
-- crearlas (en algunos proyectos storage.objects pertenece a otro rol), el
-- bucket queda cerrado para todos —seguro por defecto— y se avisa para crearlas
-- desde Storage → Policies con las mismas expresiones (ver DOCUMENTOS.md).
do $$
begin
  drop policy if exists "documentos_select_admin" on storage.objects;
  drop policy if exists "documentos_insert_admin" on storage.objects;
  drop policy if exists "documentos_update_admin" on storage.objects;
  drop policy if exists "documentos_delete_admin" on storage.objects;

  create policy "documentos_select_admin" on storage.objects
    for select to authenticated
    using (bucket_id = 'documentos' and public.is_admin());

  -- Subir: solo admin, ruta {uuid}/{archivo} y extensión permitida (además del
  -- MIME del bucket). Nada de .exe, .js, .html, .svg…
  create policy "documentos_insert_admin" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'documentos'
      and public.is_admin()
      and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and lower(storage.extension(name)) = any (array[
        'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif',
        'docx', 'xlsx', 'pptx', 'odt', 'ods', 'txt', 'md', 'csv', 'zip', 'mp4', 'mov'
      ])
    );

  create policy "documentos_update_admin" on storage.objects
    for update to authenticated
    using (bucket_id = 'documentos' and public.is_admin())
    with check (bucket_id = 'documentos' and public.is_admin());

  create policy "documentos_delete_admin" on storage.objects
    for delete to authenticated
    using (bucket_id = 'documentos' and public.is_admin());
exception when insufficient_privilege then
  raise warning 'No se pudieron crear las políticas de storage.objects (%). El bucket "documentos" queda cerrado. Créalas en Storage → Policies (ver docs/company-os/DOCUMENTOS.md).', sqlerrm;
end $$;
