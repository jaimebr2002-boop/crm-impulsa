-- Conserva en Documentos el nombre fiscal del PDF generado.
-- El nombre de la carpeta/version evita colisiones al regenerar; el archivo
-- y la descarga mantienen el nombre factura_<numero>_<cliente>.pdf.
begin;

create or replace function public.registrar_pdf_factura(
  p_factura_id uuid, p_documento_id uuid, p_storage_path text, p_tamano bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f facturas%rowtype;
  v_regenerado boolean;
  v_nombre_archivo text := regexp_replace(p_storage_path, '^.*/', '');
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
  if v_nombre_archivo !~ '^factura_[A-Za-z0-9_-]+\.pdf$' then
    raise exception 'Nombre de archivo de factura no válido.';
  end if;
  v_regenerado := f.pdf_path is not null;

  insert into documentos (id, nombre, nombre_archivo, storage_path, mime_type, tamano, categoria, factura_id, origen)
  values (p_documento_id, 'Factura ' || f.numero, v_nombre_archivo, p_storage_path,
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

commit;
