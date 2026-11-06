-- NÃO APLICADA

-- removerUsuario() falhava (AuthRetryableFetchError/500) porque dezenas de tabelas têm
-- FK para public.profiles(id) sem "on delete cascade"/"on delete set null" — o Postgres
-- bloqueia o DELETE em auth.users (que cascateia pra profiles) enquanto existir qualquer
-- linha de auditoria (created_by/updated_by/etc.) apontando pro usuário removido.
--
-- Decisão (igual à da TAREFA): não adicionar CASCADE nessas colunas — são dados de
-- auditoria (quem criou/atualizou/emitiu algo), não devem ser apagados junto com a conta.
-- Em vez disso, uma função SECURITY DEFINER nullifica essas colunas antes do
-- auth.admin.deleteUser() ser chamado (ver actions-usuarios.ts).
--
-- DESVIO em relação à TAREFA pasted, encontrado ao checar de fato a nulidade das colunas
-- (ver PERGUNTAS DE FATO na resposta): a esmagadora maioria dos "created_by" deste projeto
-- é "not null" (convenção padrão do CLAUDE.md para tabelas cujo created_by só admin
-- preenche). Um UPDATE ... SET created_by = NULL numa coluna "not null" viola a constraint
-- e falha — a função, como pedida literalmente, erraria na primeira tabela not null que
-- tivesse linha do usuário (ou seja, quase sempre). Por isso este migration primeiro
-- remove "not null" de cada uma dessas colunas (nenhuma tem NOT VALID/check extra
-- dependente disso) antes de criar a função. As colunas que já eram nullable (updated_by,
-- entregue_por, emitido_por, atualizado_por, alterado_por, leads.created_by,
-- conversas.created_by, login_banners.created_by, notificacoes_empresa.created_by) não
-- precisam de ALTER.
--
-- Segundo DESVIO: a tabela aluno_cursos_gratuitos (migration
-- 20261022150000_aluno_cursos_gratuitos.sql) também tem created_by not null sem cascade e
-- não estava na lista da TAREFA — adicionada aqui para a função cobrir de fato todas as
-- FKs sem cascade para profiles (ver levantamento completo na resposta anterior).

-- ===== Remove NOT NULL das colunas de auditoria que serão nullificadas =====

alter table public.cursos alter column created_by drop not null;
alter table public.turmas alter column created_by drop not null;
alter table public.alunos alter column created_by drop not null;
alter table public.matriculas alter column created_by drop not null;
alter table public.aulas alter column created_by drop not null;
alter table public.materiais alter column created_by drop not null;
alter table public.presencas alter column created_by drop not null;
alter table public.modulos alter column created_by drop not null;
alter table public.quizzes alter column created_by drop not null;
alter table public.questoes alter column created_by drop not null;
alter table public.alternativas alter column created_by drop not null;
alter table public.provas alter column created_by drop not null;
alter table public.questoes_prova alter column created_by drop not null;
alter table public.alternativas_prova alter column created_by drop not null;
alter table public.liberacoes_manuais alter column created_by drop not null;
alter table public.premios alter column created_by drop not null;
alter table public.contrato_template alter column created_by drop not null;
alter table public.contratos_assinados alter column created_by drop not null;
alter table public.categorias_gastos alter column created_by drop not null;
alter table public.categorias_avulsos alter column created_by drop not null;
alter table public.termos alter column created_by drop not null;
alter table public.fornecedores alter column created_by drop not null;
alter table public.cronograma_aulas alter column created_by drop not null;
alter table public.medalha_recompensas alter column created_by drop not null;
alter table public.eventos_calendario alter column created_by drop not null;
alter table public.parcelas alter column created_by drop not null;
alter table public.pagamentos_avulsos alter column created_by drop not null;
alter table public.gastos alter column created_by drop not null;
alter table public.treinamentos alter column created_by drop not null;
alter table public.estoque_itens alter column created_by drop not null;
alter table public.estoque_movimentacoes alter column created_by drop not null;
alter table public.manutencao_chamados alter column created_by drop not null;
alter table public.api_keys alter column created_by drop not null;
alter table public.campanhas_marketing alter column created_by drop not null;
alter table public.agendamento_paginas alter column created_by drop not null;
alter table public.campanha_paginas alter column created_by drop not null;
alter table public.webhooks_config alter column created_by drop not null;
alter table public.pixels_config alter column created_by drop not null;
alter table public.spedy_integracoes alter column created_by drop not null;
alter table public.email_campanhas_marketing alter column created_by drop not null;
alter table public.conquistas alter column created_by drop not null;
alter table public.whatsapp_fluxos alter column created_by drop not null;
alter table public.push_templates alter column created_by drop not null;
alter table public.push_agendamentos alter column created_by drop not null;
alter table public.config_recorrencia_notificacoes alter column created_by drop not null;
alter table public.user_permissions alter column created_by drop not null;
alter table public.aluno_cursos_gratuitos alter column created_by drop not null;

-- ===== Função: nullifica toda referência a um profiles.id antes do delete =====

create or replace function public.nullify_user_references(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cursos                      set created_by = null where created_by = p_user_id;
  update turmas                      set created_by = null where created_by = p_user_id;
  update alunos                      set created_by = null where created_by = p_user_id;
  update matriculas                  set created_by = null where created_by = p_user_id;
  update aulas                       set created_by = null where created_by = p_user_id;
  update materiais                   set created_by = null where created_by = p_user_id;
  update presencas                   set created_by = null where created_by = p_user_id;
  update modulos                     set created_by = null where created_by = p_user_id;
  update quizzes                     set created_by = null where created_by = p_user_id;
  update questoes                    set created_by = null where created_by = p_user_id;
  update alternativas                set created_by = null where created_by = p_user_id;
  update provas                      set created_by = null where created_by = p_user_id;
  update questoes_prova              set created_by = null where created_by = p_user_id;
  update alternativas_prova          set created_by = null where created_by = p_user_id;
  update liberacoes_manuais          set created_by = null where created_by = p_user_id;
  update configuracoes               set updated_by = null where updated_by = p_user_id;
  update premios                     set created_by = null where created_by = p_user_id;
  update resgates                    set entregue_por = null where entregue_por = p_user_id;
  update certificado_template        set updated_by = null where updated_by = p_user_id;
  update certificados                set emitido_por = null where emitido_por = p_user_id;
  update whatsapp_config             set updated_by = null where updated_by = p_user_id;
  update contrato_template           set created_by = null where created_by = p_user_id;
  update contrato_template           set updated_by = null where updated_by = p_user_id;
  update contratos_assinados         set created_by = null where created_by = p_user_id;
  update categorias_gastos           set created_by = null where created_by = p_user_id;
  update categorias_avulsos          set created_by = null where created_by = p_user_id;
  update leads                       set created_by = null where created_by = p_user_id;
  update termos                      set created_by = null where created_by = p_user_id;
  update fornecedores                set created_by = null where created_by = p_user_id;
  update conversas                   set created_by = null where created_by = p_user_id;
  update cronograma_aulas            set created_by = null where created_by = p_user_id;
  update medalha_recompensas         set created_by = null where created_by = p_user_id;
  update historico_alteracoes        set alterado_por = null where alterado_por = p_user_id;
  update eventos_calendario          set created_by = null where created_by = p_user_id;
  update parcelas                    set created_by = null where created_by = p_user_id;
  update pagamentos_avulsos          set created_by = null where created_by = p_user_id;
  update gastos                      set created_by = null where created_by = p_user_id;
  update treinamentos                set created_by = null where created_by = p_user_id;
  update estoque_itens               set created_by = null where created_by = p_user_id;
  update estoque_movimentacoes       set created_by = null where created_by = p_user_id;
  update manutencao_chamados         set created_by = null where created_by = p_user_id;
  update api_keys                    set created_by = null where created_by = p_user_id;
  update login_banners               set created_by = null where created_by = p_user_id;
  update notificacoes_empresa        set created_by = null where created_by = p_user_id;
  update campanhas_marketing         set created_by = null where created_by = p_user_id;
  update termos_legais               set atualizado_por = null where atualizado_por = p_user_id;
  update agendamento_paginas         set created_by = null where created_by = p_user_id;
  update campanha_paginas            set created_by = null where created_by = p_user_id;
  update webhooks_config             set created_by = null where created_by = p_user_id;
  update pixels_config               set created_by = null where created_by = p_user_id;
  update spedy_integracoes           set created_by = null where created_by = p_user_id;
  update email_campanhas_marketing   set created_by = null where created_by = p_user_id;
  update conquistas                  set created_by = null where created_by = p_user_id;
  update whatsapp_fluxos             set created_by = null where created_by = p_user_id;
  update push_templates              set created_by = null where created_by = p_user_id;
  update push_agendamentos           set created_by = null where created_by = p_user_id;
  update config_recorrencia_notificacoes set created_by = null where created_by = p_user_id;
  update user_permissions            set created_by = null where created_by = p_user_id;
  update aluno_cursos_gratuitos      set created_by = null where created_by = p_user_id;
end;
$$;

grant execute on function public.nullify_user_references(uuid) to service_role;
