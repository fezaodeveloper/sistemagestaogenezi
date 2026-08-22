alter table public.matriculas
  add column taxa_cartao numeric(5, 2) default null;

grant insert (taxa_cartao) on public.matriculas to authenticated;
grant update (taxa_cartao) on public.matriculas to authenticated;
