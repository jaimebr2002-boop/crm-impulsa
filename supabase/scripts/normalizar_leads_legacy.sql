-- ============================================================
-- Normalización OPCIONAL de valores antiguos de leads (producción)
-- ============================================================
-- NO es una migración: no está en supabase/migrations y no se ejecuta sola.
-- Solo con aprobación explícita, después del backup y ANTES de 0008.
--
-- Qué arregla: leads importados de hojas de cálculo guardan estado, canal y
-- segmento con otra forma ("Contactado", "Cerrado", "WhatsApp", "Frío"). La app
-- ya los tolera al leer (constants.ts → estadoCanonico), pero:
--   · los filtros de segmento/canal no los encuentran,
--   · "En negociación", "No tocar", "No la vieron" no tienen equivalente.
--
-- Cómo se usa:
--   1. Ejecutar la PARTE 1 (solo lectura) y revisar el resultado.
--   2. Decidir los valores marcados con «DECIDIR» (por defecto se dejan igual).
--   3. Ejecutar la PARTE 2 entera (una transacción; revisa y termina en COMMIT
--      o cámbialo por ROLLBACK para ensayar).
--
-- Los triggers se desactivan dentro de la transacción: updated_at no cambia
-- (la lista no se reordena) y, si 0008 ya estuviera aplicada, no se generan
-- decenas de entradas falsas de "cambió de estado" en Actividad.

-- ============================================================
-- PARTE 1 — Vista previa (solo lectura)
-- ============================================================
select 'estado' campo, estado valor, count(*) from leads group by estado
union all select 'canal', canal, count(*) from leads group by canal
union all select 'segmento', segmento, count(*) from leads group by segmento
union all select 'origen', origen, count(*) from leads group by origen
order by 1, 2;

-- ============================================================
-- PARTE 2 — Aplicar (transacción)
-- ============================================================
begin;
set local session_replication_role = replica;  -- sin triggers en esta transacción

-- Copia de seguridad de las columnas afectadas (se puede borrar tras validar).
create table if not exists public.leads_valores_legacy as
  select id, estado, canal, segmento, origen, now() as copiado_en from leads;
alter table public.leads_valores_legacy enable row level security;  -- sin políticas: invisible para la app

-- Equivalencias inequívocas (solo mayúsculas/tildes).
update leads set estado = lower(estado) where estado in ('Contactado', 'Descartado', 'Pendiente', 'Interesado', 'Respondido');
update leads set canal = lower(canal) where canal in ('WhatsApp', 'Instagram', 'Llamada', 'Email', 'LinkedIn');
update leads set segmento = 'frio' where segmento = 'Frío';
update leads set segmento = 'caliente' where segmento = 'Caliente';
update leads set segmento = 'timing' where segmento = 'Timing';
update leads set segmento = null where segmento = '';

-- DECIDIR (descomentar la opción elegida; si no, se quedan como están y la app
-- los muestra tal cual en "Otros estados"):
-- "Cerrado" (18, todos con segmento "No tocar"): ¿ganado o perdido?
-- update leads set estado = 'cerrado'    where estado = 'Cerrado';   -- Ganado
-- update leads set estado = 'descartado' where estado = 'Cerrado';   -- Perdido
-- update leads set estado = 'interesado' where estado = 'En negociación';
-- update leads set estado = 'reunión'    where estado = 'En negociación';
-- update leads set segmento = 'off'   where segmento = 'No tocar';
-- update leads set segmento = 'ghost' where segmento = 'No la vieron';
-- "Demo Vercel 2025" (origen) se deja: es texto libre y se muestra tal cual.

-- Comprobación antes de confirmar: mismo número de leads.
select count(*) as leads, (select count(*) from public.leads_valores_legacy) as copia from leads;

commit;  -- o rollback; para ensayar
