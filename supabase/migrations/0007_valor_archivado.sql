-- Valor económico por lead, archivado y borrado (solo admin).
-- Idempotente: puede ejecutarse varias veces sin efectos secundarios.

-- ============================================================
-- 1. Valor en euros del lead (estimado mientras está abierto, real al cerrar)
-- ============================================================
alter table leads add column if not exists valor numeric(12, 2);

alter table leads
  drop constraint if exists leads_valor_check,
  add constraint leads_valor_check check (valor is null or valor >= 0);

comment on column leads.valor is 'Importe en euros del lead: estimado mientras está abierto, facturado cuando está cerrado. Puede ser null.';

-- ============================================================
-- 2. Archivado: saca un lead de las listas y del pipeline sin perder su historial
-- ============================================================
alter table leads add column if not exists archivado boolean not null default false;

comment on column leads.archivado is 'Lead archivado: oculto en listas, tablero y pipeline, pero conserva interacciones y eventos.';

create index if not exists idx_leads_archivado on leads (archivado);

-- ============================================================
-- 3. Borrado definitivo: solo admin (interacciones y eventos caen en cascada)
-- ============================================================
drop policy if exists "leads_delete" on leads;
create policy "leads_delete" on leads
  for delete to authenticated
  using (public.is_admin());
