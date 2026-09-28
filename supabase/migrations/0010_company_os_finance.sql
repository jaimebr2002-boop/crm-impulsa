-- Company OS — Fase 3 (Finanzas).
--
-- Modelo:
--   cuentas ─┬─< facturas ─┬─< factura_lineas >── proyectos (opcional)
--            │             └─< cobros
--            └─< gastos >── proyectos / suscripciones (opcionales)
--   suscripciones (plantilla recurrente) ──< gastos (movimientos reales)
--
-- Reglas (fuente de verdad en la base de datos, no en el navegador):
--   · importe de línea = round(cantidad × precio_unitario, 2)
--   · base = Σ importes de línea; iva = round(base × iva_pct / 100, 2);
--     irpf = round(base × irpf_pct / 100, 2); total = base + iva − irpf
--   · cobrado = Σ cobros; pendiente = total − cobrado
--   · estado de cobro (borrador / pendiente / parcial / cobrada / vencida /
--     cancelada) se DERIVA en la vista facturas_estado: nunca se guarda.
--   · round() de numeric redondea al céntimo alejándose de cero (0,005 → 0,01).
--
-- Solo admin (RLS). No destructiva e idempotente.

-- ============================================================
-- 1. Facturas
-- ============================================================
create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  -- null mientras es borrador: el número se asigna al emitir (correlativo).
  numero text,
  cuenta_id uuid not null references cuentas(id) on delete restrict,
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida', 'cancelada')),
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  iva_pct numeric(5, 2) not null default 21 check (iva_pct between 0 and 100),
  irpf_pct numeric(5, 2) not null default 7 check (irpf_pct between 0 and 100),
  -- Calculados por trigger a partir de las líneas (no se escriben a mano).
  base numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  irpf numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  moneda char(3) not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  enviada_en timestamptz,
  notas text,
  -- Fase 4 (Documentos): ruta del PDF en Supabase Storage. Nunca el archivo aquí.
  pdf_path text,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facturas_vencimiento_valido check (fecha_vencimiento is null or fecha_vencimiento >= fecha_emision),
  constraint facturas_emitida_con_numero check (estado = 'borrador' or numero is not null)
);

create unique index if not exists uq_facturas_numero on facturas (numero) where numero is not null;
create index if not exists idx_facturas_cuenta on facturas (cuenta_id);
create index if not exists idx_facturas_emision on facturas (fecha_emision desc);
create index if not exists idx_facturas_vencimiento on facturas (fecha_vencimiento) where estado = 'emitida';

comment on table facturas is 'Facturas emitidas (registro interno, no software fiscal). Totales calculados en BD desde factura_lineas.';

-- Contador por año para numerar sin duplicados aunque haya altas simultáneas.
create table if not exists factura_series (
  anio int primary key check (anio between 2000 and 2999),
  ultimo int not null default 0 check (ultimo >= 0)
);

create or replace function public.siguiente_numero_factura(p_anio int)
returns text
language plpgsql
set search_path = public
as $$
declare
  n int;
  candidato text;
begin
  loop
    -- El upsert bloquea la fila del año: dos emisiones a la vez nunca obtienen el mismo número.
    insert into factura_series (anio, ultimo) values (p_anio, 1)
      on conflict (anio) do update set ultimo = factura_series.ultimo + 1
      returning ultimo into n;
    candidato := p_anio::text || '-' || lpad(n::text, 3, '0');
    -- Si ese número ya se usó a mano, se salta al siguiente.
    exit when not exists (select 1 from facturas where numero = candidato);
  end loop;
  return candidato;
end;
$$;

-- ============================================================
-- 2. Líneas (relación N:M factura ↔ proyecto, más líneas manuales)
-- ============================================================
create table if not exists factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  proyecto_id uuid references proyectos(id) on delete set null,
  descripcion text not null check (length(trim(descripcion)) > 0),
  cantidad numeric(10, 2) not null default 1 check (cantidad > 0),
  -- Puede ser negativo (descuentos).
  precio_unitario numeric(12, 2) not null,
  importe numeric(12, 2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_factura_lineas_factura on factura_lineas (factura_id, orden);
create index if not exists idx_factura_lineas_proyecto on factura_lineas (proyecto_id) where proyecto_id is not null;

-- ============================================================
-- 3. Cobros (0..n por factura: pagos parciales)
-- ============================================================
create table if not exists cobros (
  id uuid primary key default gen_random_uuid(),
  -- restrict: una factura con cobros no se puede borrar (se cancela).
  factura_id uuid not null references facturas(id) on delete restrict,
  fecha date not null default current_date,
  importe numeric(12, 2) not null check (importe > 0),
  metodo text not null default 'transferencia'
    check (metodo in ('transferencia', 'tarjeta', 'efectivo', 'bizum', 'domiciliacion', 'otro')),
  referencia text,
  notas text,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_cobros_factura on cobros (factura_id);
create index if not exists idx_cobros_fecha on cobros (fecha desc);

-- ============================================================
-- 4. Suscripciones (plantilla) y gastos (movimientos reales)
-- ============================================================
create table if not exists suscripciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  proveedor text,
  categoria text not null default 'software'
    check (categoria in ('software', 'hardware', 'publicidad', 'transporte', 'comida', 'gestoria', 'formacion', 'oficina', 'otros')),
  importe numeric(12, 2) not null check (importe > 0),
  periodicidad text not null default 'mensual' check (periodicidad in ('mensual', 'trimestral', 'anual')),
  fecha_inicio date not null default current_date,
  proxima_renovacion date not null,
  activa boolean not null default true,
  notas text,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suscripciones_renovacion on suscripciones (proxima_renovacion) where activa;

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null check (length(trim(concepto)) > 0),
  fecha date not null default current_date,
  -- Importe pagado (IVA incluido): es lo que sale de caja.
  importe numeric(12, 2) not null check (importe > 0),
  categoria text not null default 'otros'
    check (categoria in ('software', 'hardware', 'publicidad', 'transporte', 'comida', 'gestoria', 'formacion', 'oficina', 'otros')),
  proveedor text,
  cuenta_id uuid references cuentas(id) on delete set null,
  proyecto_id uuid references proyectos(id) on delete set null,
  suscripcion_id uuid references suscripciones(id) on delete set null,
  -- Informativo: no hace cálculos fiscales.
  deducible boolean not null default true,
  notas text,
  -- Fase 4 (Documentos): ruta del justificante en Supabase Storage.
  justificante_path text,
  creado_por uuid references usuarios(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gastos_fecha on gastos (fecha desc);
create index if not exists idx_gastos_categoria on gastos (categoria);
create index if not exists idx_gastos_proyecto on gastos (proyecto_id) where proyecto_id is not null;
create index if not exists idx_gastos_cuenta on gastos (cuenta_id) where cuenta_id is not null;
-- Un periodo de una suscripción solo se registra una vez.
create unique index if not exists uq_gastos_suscripcion_fecha on gastos (suscripcion_id, fecha) where suscripcion_id is not null;

-- ============================================================
-- 5. Triggers de cálculo y coherencia
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['facturas', 'suscripciones', 'gastos'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', t);
    execute format('create trigger trg_%1$s_updated_at before update on %1$I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- Recalcula totales y asigna número. Es el ÚNICO sitio donde se calculan importes de factura.
create or replace function public.facturas_antes_de_guardar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cobrado numeric(12, 2);
begin
  new.numero := nullif(trim(new.numero), '');

  if new.estado <> 'borrador' and new.numero is null then
    new.numero := siguiente_numero_factura(extract(year from new.fecha_emision)::int);
  end if;

  if tg_op = 'INSERT' then
    new.base := 0;
  else
    select coalesce(sum(importe), 0) into new.base from factura_lineas where factura_id = new.id;
  end if;
  new.iva := round(new.base * new.iva_pct / 100, 2);
  new.irpf := round(new.base * new.irpf_pct / 100, 2);
  new.total := new.base + new.iva - new.irpf;

  if tg_op = 'UPDATE' and new.estado = 'borrador' and old.estado <> 'borrador' then
    select coalesce(sum(importe), 0) into v_cobrado from cobros where factura_id = new.id;
    if v_cobrado > 0 then
      raise exception 'Una factura con cobros no puede volver a borrador.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_facturas_antes_de_guardar on facturas;
create trigger trg_facturas_antes_de_guardar
  before insert or update on facturas
  for each row execute function public.facturas_antes_de_guardar();

-- Cobros ≤ total, comprobado AL CONFIRMAR la transacción: al reemplazar las
-- líneas el total pasa momentáneamente por 0 y no debe dar error.
create or replace function public.facturas_validar_cobros()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total numeric(12, 2);
  v_cobrado numeric(12, 2);
begin
  select total into v_total from facturas where id = new.id;
  if not found then
    return null;
  end if;
  select coalesce(sum(importe), 0) into v_cobrado from cobros where factura_id = new.id;
  if v_cobrado > v_total then
    raise exception 'Los cobros registrados (% €) superan el total de la factura (% €).', v_cobrado, v_total;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_facturas_validar_cobros on facturas;
create constraint trigger trg_facturas_validar_cobros
  after update on facturas
  deferrable initially deferred
  for each row execute function public.facturas_validar_cobros();

create or replace function public.facturas_antes_de_borrar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado <> 'borrador' then
    raise exception 'Solo se pueden eliminar borradores. Una factura emitida se cancela.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_facturas_antes_de_borrar on facturas;
create trigger trg_facturas_antes_de_borrar
  before delete on facturas
  for each row execute function public.facturas_antes_de_borrar();

-- Cualquier cambio en las líneas recalcula la factura (vía su trigger BEFORE UPDATE).
create or replace function public.factura_lineas_recalcular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update facturas set updated_at = now() where id = old.factura_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.factura_id is distinct from old.factura_id) then
    update facturas set updated_at = now() where id = new.factura_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_factura_lineas_recalcular on factura_lineas;
create trigger trg_factura_lineas_recalcular
  after insert or update or delete on factura_lineas
  for each row execute function public.factura_lineas_recalcular();

-- Un cobro solo en facturas emitidas y nunca por encima de lo pendiente.
create or replace function public.cobros_validar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  f record;
  v_otros numeric(12, 2);
begin
  select estado, total into f from facturas where id = new.factura_id for update;
  if f.estado <> 'emitida' then
    raise exception 'Solo se pueden registrar cobros en facturas emitidas.';
  end if;
  select coalesce(sum(importe), 0) into v_otros from cobros
    where factura_id = new.factura_id and (tg_op = 'INSERT' or id <> new.id);
  if v_otros + new.importe > f.total then
    raise exception 'El cobro supera lo pendiente de la factura (% €).', f.total - v_otros;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cobros_validar on cobros;
create trigger trg_cobros_validar
  before insert or update on cobros
  for each row execute function public.cobros_validar();

-- ============================================================
-- 6. Vistas derivadas (security_invoker: aplican la RLS de quien consulta)
-- ============================================================
create or replace view facturas_estado with (security_invoker = true) as
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
  c.ultimo_cobro
from facturas f
left join (
  select factura_id, sum(importe) as cobrado, max(fecha) as ultimo_cobro
  from cobros
  group by factura_id
) c on c.factura_id = f.id;

comment on view facturas_estado is 'Factura + cobrado, pendiente y estado de cobro derivado. Leer siempre de aquí.';

-- Facturación por proyecto, en BASE (sin IVA) para compararla con el valor
-- del proyecto. El cobrado se reparte proporcionalmente: si una factura de
-- 4 proyectos está cobrada al 50 %, cada línea cuenta como cobrada al 50 %.
create or replace view proyectos_facturacion with (security_invoker = true) as
select
  l.proyecto_id,
  count(distinct l.factura_id)::int as facturas,
  sum(l.importe)::numeric(12, 2) as facturado,
  sum(
    case when fe.total > 0 then round(l.importe * least(fe.cobrado / fe.total, 1), 2) else 0 end
  )::numeric(12, 2) as cobrado
from factura_lineas l
join facturas_estado fe on fe.id = l.factura_id
where l.proyecto_id is not null and fe.estado = 'emitida'
group by l.proyecto_id;

-- ============================================================
-- 7. Operaciones atómicas (RPC)
-- ============================================================
-- Crea o actualiza una factura con todas sus líneas en una sola transacción.
-- p_factura: {cuenta_id, fecha_emision, fecha_vencimiento, iva_pct, irpf_pct, notas, numero, estado}
-- p_lineas:  [{proyecto_id, descripcion, cantidad, precio_unitario}, …]
create or replace function public.guardar_factura(p_id uuid, p_factura jsonb, p_lineas jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_estado text := coalesce(p_factura->>'estado', 'borrador');
begin
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La factura necesita al menos una línea.';
  end if;

  if v_id is null then
    -- Se crea como borrador y se emite al final: así la actividad registra el
    -- total ya calculado y el número solo se consume si todo va bien.
    insert into facturas (cuenta_id, fecha_emision, fecha_vencimiento, iva_pct, irpf_pct, notas, numero, estado)
    values (
      (p_factura->>'cuenta_id')::uuid,
      coalesce((p_factura->>'fecha_emision')::date, current_date),
      (p_factura->>'fecha_vencimiento')::date,
      coalesce((p_factura->>'iva_pct')::numeric, 21),
      coalesce((p_factura->>'irpf_pct')::numeric, 7),
      p_factura->>'notas',
      p_factura->>'numero',
      'borrador'
    )
    returning id into v_id;
  else
    update facturas set
      cuenta_id = (p_factura->>'cuenta_id')::uuid,
      fecha_emision = coalesce((p_factura->>'fecha_emision')::date, fecha_emision),
      fecha_vencimiento = (p_factura->>'fecha_vencimiento')::date,
      iva_pct = coalesce((p_factura->>'iva_pct')::numeric, iva_pct),
      irpf_pct = coalesce((p_factura->>'irpf_pct')::numeric, irpf_pct),
      notas = p_factura->>'notas',
      numero = coalesce(nullif(trim(p_factura->>'numero'), ''), numero)
    where id = v_id;
    if not found then
      raise exception 'Factura no encontrada.';
    end if;
    delete from factura_lineas where factura_id = v_id;
  end if;

  insert into factura_lineas (factura_id, proyecto_id, descripcion, cantidad, precio_unitario, orden)
  select
    v_id,
    nullif(l->>'proyecto_id', '')::uuid,
    l->>'descripcion',
    coalesce((l->>'cantidad')::numeric, 1),
    (l->>'precio_unitario')::numeric,
    (n - 1)::int
  from jsonb_array_elements(p_lineas) with ordinality as t(l, n);

  if v_estado = 'emitida' then
    update facturas set estado = 'emitida' where id = v_id and estado = 'borrador';
  end if;
  return v_id;
end;
$$;

-- Registra el gasto real del periodo de una suscripción y avanza su renovación.
create or replace function public.registrar_renovacion(p_suscripcion_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  s record;
  v_gasto uuid;
begin
  select * into s from suscripciones where id = p_suscripcion_id for update;
  if not found then
    raise exception 'Suscripción no encontrada.';
  end if;

  insert into gastos (concepto, fecha, importe, categoria, proveedor, suscripcion_id)
  values (s.nombre, s.proxima_renovacion, s.importe, s.categoria, s.proveedor, s.id)
  returning id into v_gasto;

  update suscripciones set proxima_renovacion = (
    s.proxima_renovacion + case s.periodicidad
      when 'mensual' then interval '1 month'
      when 'trimestral' then interval '3 months'
      else interval '1 year'
    end
  )::date
  where id = s.id;

  return v_gasto;
exception when unique_violation then
  raise exception 'Este periodo (%) ya estaba registrado.', s.proxima_renovacion;
end;
$$;

-- ============================================================
-- 8. Actividad financiera (sin ruido: nunca los recálculos)
-- ============================================================
create or replace function public.actividad_facturas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta text;
  v_datos jsonb;
begin
  select nombre into v_cuenta from cuentas where id = new.cuenta_id;
  v_datos := jsonb_build_object('numero', new.numero, 'total', new.total, 'cuenta_nombre', v_cuenta);
  if new.estado is distinct from old.estado then
    if new.estado = 'emitida' then
      perform registrar_actividad_ctx('factura', new.id, 'emitida', new.numero, v_datos, new.cuenta_id, null);
    elsif new.estado = 'cancelada' then
      perform registrar_actividad_ctx('factura', new.id, 'cancelada', new.numero, v_datos, new.cuenta_id, null);
    end if;
  end if;
  if new.enviada_en is not null and old.enviada_en is null then
    perform registrar_actividad_ctx('factura', new.id, 'enviada', new.numero, v_datos, new.cuenta_id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_facturas on facturas;
create trigger trg_actividad_facturas
  after update on facturas
  for each row execute function public.actividad_facturas();

create or replace function public.actividad_cobros()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  v_cobrado numeric(12, 2);
begin
  select id, numero, total, cuenta_id into f from facturas where id = coalesce(new.factura_id, old.factura_id);
  if tg_op = 'INSERT' then
    perform registrar_actividad_ctx('cobro', new.id, 'registrado', f.numero,
      jsonb_build_object('importe', new.importe, 'metodo', new.metodo, 'factura_id', f.id, 'numero', f.numero),
      f.cuenta_id, null);
    select coalesce(sum(importe), 0) into v_cobrado from cobros where factura_id = f.id;
    if v_cobrado >= f.total then
      perform registrar_actividad_ctx('factura', f.id, 'cobrada', f.numero,
        jsonb_build_object('numero', f.numero, 'total', f.total), f.cuenta_id, null);
    end if;
  elsif tg_op = 'DELETE' then
    perform registrar_actividad_ctx('cobro', old.id, 'eliminado', f.numero,
      jsonb_build_object('importe', old.importe, 'factura_id', f.id, 'numero', f.numero), f.cuenta_id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_cobros on cobros;
create trigger trg_actividad_cobros
  after insert or delete on cobros
  for each row execute function public.actividad_cobros();

create or replace function public.actividad_gastos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform registrar_actividad_ctx('gasto', new.id, 'creado', new.concepto,
    jsonb_build_object('importe', new.importe, 'categoria', new.categoria, 'suscripcion_id', new.suscripcion_id),
    new.cuenta_id, new.proyecto_id);
  return null;
end;
$$;

drop trigger if exists trg_actividad_gastos on gastos;
create trigger trg_actividad_gastos
  after insert on gastos
  for each row execute function public.actividad_gastos();

create or replace function public.actividad_suscripciones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform registrar_actividad_ctx('suscripcion', new.id, 'creado', new.nombre,
      jsonb_build_object('importe', new.importe, 'periodicidad', new.periodicidad), null, null);
  elsif new.activa is distinct from old.activa then
    perform registrar_actividad_ctx('suscripcion', new.id, case when new.activa then 'reactivada' else 'pausada' end,
      new.nombre, '{}'::jsonb, null, null);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_actividad_suscripciones on suscripciones;
create trigger trg_actividad_suscripciones
  after insert or update on suscripciones
  for each row execute function public.actividad_suscripciones();

-- ============================================================
-- 9. RLS: todo el sistema financiero es solo admin
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['facturas', 'factura_lineas', 'cobros', 'gastos', 'suscripciones', 'factura_series'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%1$s_admin" on %1$I', t);
    execute format(
      'create policy "%1$s_admin" on %1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Funciones: ni anónimos ni ejecución directa de las internas.
revoke execute on function public.siguiente_numero_factura(int) from public, anon;
revoke execute on function public.guardar_factura(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.registrar_renovacion(uuid) from public, anon;
grant execute on function public.guardar_factura(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.registrar_renovacion(uuid) to authenticated;
grant execute on function public.siguiente_numero_factura(int) to authenticated;
revoke execute on function public.facturas_antes_de_guardar() from public, anon, authenticated;
revoke execute on function public.facturas_antes_de_borrar() from public, anon, authenticated;
revoke execute on function public.facturas_validar_cobros() from public, anon, authenticated;
revoke execute on function public.factura_lineas_recalcular() from public, anon, authenticated;
revoke execute on function public.cobros_validar() from public, anon, authenticated;
revoke execute on function public.actividad_facturas() from public, anon, authenticated;
revoke execute on function public.actividad_cobros() from public, anon, authenticated;
revoke execute on function public.actividad_gastos() from public, anon, authenticated;
revoke execute on function public.actividad_suscripciones() from public, anon, authenticated;
