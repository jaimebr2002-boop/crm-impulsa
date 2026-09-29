-- Datos que faltaban para conservar facturas históricas y reproducir su formato.
-- Aditiva: no cambia ni renumera facturas existentes.
begin;

alter table public.facturas
  add column if not exists fecha_operacion date,
  add column if not exists texto_legal text,
  add column if not exists concepto_pago text;

alter table public.ajustes_facturacion
  add column if not exists titular_iban text;

alter table public.factura_lineas
  add column if not exists concepto text;

-- El PDF debe pasar a desactualizado si cambia cualquier campo impreso,
-- incluido el desglose de concepto/descripcion o la información de pago.
create or replace function public.factura_huella(p_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select md5(concat_ws('|',
    f.numero, f.estado, f.fecha_emision, f.fecha_operacion, f.fecha_vencimiento,
    f.cuenta_id, f.iva_pct, f.irpf_pct, f.base, f.iva, f.irpf, f.total, f.moneda,
    f.texto_legal, f.concepto_pago,
    (select string_agg(concat_ws('~', l.orden, l.concepto, l.descripcion, l.cantidad, l.precio_unitario, l.importe), '¶' order by l.orden, l.id)
       from factura_lineas l where l.factura_id = f.id),
    (select string_agg(concat_ws('~', c.fecha, c.importe, c.metodo, c.referencia), '¶' order by c.fecha, c.id)
       from cobros c where c.factura_id = f.id)
  ))
  from facturas f where f.id = p_id
$$;

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
    insert into facturas (
      cuenta_id, fecha_emision, fecha_operacion, fecha_vencimiento,
      iva_pct, irpf_pct, notas, texto_legal, concepto_pago, numero, estado
    ) values (
      (p_factura->>'cuenta_id')::uuid,
      coalesce((p_factura->>'fecha_emision')::date, current_date),
      (p_factura->>'fecha_operacion')::date,
      (p_factura->>'fecha_vencimiento')::date,
      coalesce((p_factura->>'iva_pct')::numeric, 21),
      coalesce((p_factura->>'irpf_pct')::numeric, 7),
      p_factura->>'notas', p_factura->>'texto_legal', p_factura->>'concepto_pago',
      p_factura->>'numero', 'borrador'
    ) returning id into v_id;
  else
    update facturas set
      cuenta_id = (p_factura->>'cuenta_id')::uuid,
      fecha_emision = coalesce((p_factura->>'fecha_emision')::date, fecha_emision),
      fecha_operacion = (p_factura->>'fecha_operacion')::date,
      fecha_vencimiento = (p_factura->>'fecha_vencimiento')::date,
      iva_pct = coalesce((p_factura->>'iva_pct')::numeric, iva_pct),
      irpf_pct = coalesce((p_factura->>'irpf_pct')::numeric, irpf_pct),
      notas = p_factura->>'notas',
      texto_legal = p_factura->>'texto_legal',
      concepto_pago = p_factura->>'concepto_pago',
      numero = coalesce(nullif(trim(p_factura->>'numero'), ''), numero)
    where id = v_id;
    if not found then raise exception 'Factura no encontrada.'; end if;
    delete from factura_lineas where factura_id = v_id;
  end if;

  insert into factura_lineas (factura_id, proyecto_id, concepto, descripcion, cantidad, precio_unitario, orden)
  select v_id, nullif(l->>'proyecto_id', '')::uuid, coalesce(nullif(trim(l->>'concepto'), ''), l->>'descripcion'), l->>'descripcion',
    coalesce((l->>'cantidad')::numeric, 1), (l->>'precio_unitario')::numeric, (n - 1)::int
  from jsonb_array_elements(p_lineas) with ordinality as t(l, n);

  if v_estado = 'emitida' then
    update facturas set estado = 'emitida' where id = v_id and estado = 'borrador';
  end if;
  return v_id;
end;
$$;

commit;
