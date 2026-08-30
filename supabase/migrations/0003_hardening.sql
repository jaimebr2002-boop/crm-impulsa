-- Fija search_path en la función de trigger existente (evita hijacking via search_path).
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user() solo debe dispararse como trigger, no ser invocable via RPC directo.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
