-- ============================================================
-- 0012 · Endurecimiento tras validar 0008–0011 en Supabase real (staging)
-- ============================================================
-- Avisos del linter de seguridad de Supabase. Sin cambios de datos.
-- Idempotente.

-- 1. is_admin() no tiene por qué ser invocable sin sesión (/rest/v1/rpc/is_admin).
--    Las políticas que la usan son "to authenticated"; la de UPDATE de usuarios
--    (0006) es "to public", pero un anónimo no tiene fila que actualizar: con el
--    permiso retirado recibe un error en vez de 0 filas, igualmente denegado.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. search_path fijo en la única función de 0011 que no lo tenía.
alter function public.documento_mime_permitido(text) set search_path = public;
