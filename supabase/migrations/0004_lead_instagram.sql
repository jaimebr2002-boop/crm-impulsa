-- Añade Instagram como dato de contacto del lead, junto al teléfono.
-- Columna opcional: los leads existentes quedan con instagram = null sin
-- que se rompa nada (no tiene default ni constraint de not null).
alter table leads add column if not exists instagram text;

comment on column leads.instagram is 'Usuario/handle de Instagram del lead, normalizado con @ delante (ej. @negocio). Puede ser null.';
