-- Gênezi Conecta — endereço completo e link do Google Maps da empresa,
-- usados no card/modal de detalhes da vaga pro aluno.
--
-- Mostrar SQL — NÃO aplicar.

alter table public.empresas_conecta
  add column if not exists endereco text,
  add column if not exists link_maps text;

grant update (endereco, link_maps) on public.empresas_conecta to authenticated;
grant insert (endereco, link_maps) on public.empresas_conecta to authenticated;
