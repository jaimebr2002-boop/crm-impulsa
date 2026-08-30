-- Seed de usuarios — Jaime, Laura y Reyes.
-- Idempotente: no duplica si ya existen usuarios con esos nombres.

insert into usuarios (nombre)
select v.nombre
from (values ('Jaime'), ('Laura'), ('Reyes')) as v(nombre)
where not exists (
  select 1 from usuarios u where u.nombre = v.nombre
);
