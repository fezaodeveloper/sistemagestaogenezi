-- Texto configurável do Termo de Uso de Imagem impresso no comprovante de
-- matrícula (roadmap, item 5).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists termo_imagem_texto text
    default 'Autorizo a Gênezi Educação Profissional a utilizar minha
imagem e voz, captadas durante as atividades do curso, em materiais
institucionais, redes sociais e divulgação da escola, sem fins lucrativos
e sem direito a remuneração.';

-- SELECT já é liberado pra authenticated na tabela toda (sem lista de
-- colunas) desde 20260821100000_create_pontos_gamificacao.sql — só falta o
-- GRANT de UPDATE pra essa coluna nova.
grant update (termo_imagem_texto) on public.configuracoes to authenticated;
