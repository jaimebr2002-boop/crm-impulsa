-- ============================================================
-- Huella de los datos del CRM (solo lectura)
-- ============================================================
-- Ejecutar ANTES y DESPUÉS de migrar y comparar: el número de filas y la
-- huella de cada tabla deben coincidir. Cualquier diferencia = parar.
-- La huella cubre las columnas que existían antes del Company OS; las
-- columnas nuevas (valor, archivado, tipo…) no entran, así que añadir
-- columnas no la cambia, pero modificar un dato existente sí.
select 'usuarios' as tabla, count(*) as filas,
  md5(string_agg(md5(row(id, nombre, email, rol)::text), '' order by id)) as huella
from usuarios
union all
select 'leads', count(*),
  md5(string_agg(md5(row(id, negocio, nombre_contacto, telefono, estado, origen, segmento, canal,
                         asignado_a, email, enlace_demo, instagram, created_at)::text), '' order by id))
from leads
union all
select 'interacciones', count(*),
  md5(string_agg(md5(row(id, lead_id, usuario_id, fecha, canal, resultado, nota)::text), '' order by id))
from interacciones
union all
select 'eventos', count(*),
  md5(string_agg(md5(row(id, lead_id, usuario_id, titulo, fecha_hora, completada)::text), '' order by id))
from eventos
union all
select 'auth.users', count(*), md5(string_agg(id::text, '' order by id)) from auth.users
order by 1;
