-- La tabla usuarios no tenía ninguna policy de UPDATE: cualquier intento de
-- guardar la preferencia de notificaciones fallaba en silencio (RLS afecta
-- 0 filas sin lanzar error). Se añade una policy de UPDATE, restringida por
-- trigger para que un usuario no admin solo pueda tocar su propia
-- preferencia de notificaciones (nunca su rol, nombre o email).

create or replace function usuarios_restringir_autoedicion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    if new.rol is distinct from old.rol
      or new.nombre is distinct from old.nombre
      or new.email is distinct from old.email
      or new.id is distinct from old.id then
      raise exception 'No tienes permiso para modificar estos campos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_restringir_autoedicion_trigger on usuarios;
create trigger usuarios_restringir_autoedicion_trigger
before update on usuarios
for each row
execute function usuarios_restringir_autoedicion();

create policy "usuarios_update_propio_o_admin" on usuarios
for update
using (auth.uid() = id or is_admin())
with check (auth.uid() = id or is_admin());
