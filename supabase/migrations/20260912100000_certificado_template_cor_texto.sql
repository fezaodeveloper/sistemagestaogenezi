-- Cor do texto do certificado, configurável separadamente para frente e
-- verso. Mesmo padrão de coluna adicionada depois em certificado_template
-- já usado em 20260830100000_certificado_template_layout.sql: o UPDATE
-- nessa tabela é concedido por lista de colunas (não a tabela toda), então
-- sem o GRANT abaixo o admin não conseguiria salvar os campos novos.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.certificado_template
  add column if not exists cor_texto_frente text default '#000000',
  add column if not exists cor_texto_verso text default '#000000';

grant update (cor_texto_frente, cor_texto_verso) on public.certificado_template to authenticated;
