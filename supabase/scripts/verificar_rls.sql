-- ============================================================
-- Verificación de RLS con usuarios reales (solo lectura)
-- ============================================================
-- Cuenta lo que ve cada rol (un admin, un comercial y anónimo) en cada tabla,
-- ejecutando las consultas CON ese rol, igual que la app. No escribe nada:
-- la función vive en una transacción que termina en ROLLBACK.
--
-- Esperado:
--   · admin     → ve todo.
--   · comercial → solo sus leads/interacciones/eventos/tareas y la lista de
--                 usuarios; 0 en cuentas, proyectos, finanzas, documentos,
--                 actividad, ajustes y storage.
--   · anónimo   → 0 en todo.
begin;

create function pg_temp.ver_como(p_rol text, p_uid uuid) returns jsonb
language plpgsql as $$
declare r jsonb := '{}'; t text; n bigint;
begin
  if p_rol = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  foreach t in array array['usuarios', 'leads', 'interacciones', 'eventos', 'tareas', 'cuentas', 'marcas',
    'proyectos', 'proyecto_enlaces', 'actividad', 'facturas', 'factura_lineas', 'cobros', 'gastos',
    'suscripciones', 'documentos', 'ajustes_facturacion'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      r := r || jsonb_build_object(t, n);
    exception when others then
      r := r || jsonb_build_object(t, 'error: ' || sqlstate);
    end;
  end loop;
  select count(*) into n from storage.objects where bucket_id = 'documentos';
  r := r || jsonb_build_object('storage.documentos', n);
  execute 'reset role';
  return r;
end $$;

select 'admin' as rol, pg_temp.ver_como('authenticated', (select id from usuarios where rol = 'admin' limit 1)) as visible
union all
select 'comercial', pg_temp.ver_como('authenticated', (select id from usuarios where rol = 'comercial' order by email limit 1))
union all
select 'anónimo', pg_temp.ver_como('anon', null);

rollback;
