-- ============================================================
-- 0015 · RLS de leads: evaluar is_admin()/auth.uid() una vez por consulta
-- ============================================================
-- Mismo significado que antes (admin ve/edita todo; un comercial, sus leads).
-- Envolver las funciones en (select …) hace que Postgres las calcule una sola
-- vez en lugar de una por fila: con ~29.000 leads cada escaneo pasa de ~450 ms
-- a unos pocos. Idempotente.
alter policy leads_select on public.leads
  using ((select public.is_admin()) or asignado_a = (select auth.uid()));
alter policy leads_update on public.leads
  using ((select public.is_admin()) or asignado_a = (select auth.uid()))
  with check ((select public.is_admin()) or asignado_a = (select auth.uid()));
