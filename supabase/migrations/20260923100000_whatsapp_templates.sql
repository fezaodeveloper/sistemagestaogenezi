-- GênZap Fase 2 — catálogo unificado de templates de WhatsApp (Configurações > WhatsApp >
-- Templates), substituindo as 4 colunas soltas de `whatsapp_config`.
--
-- ===== O QUE JÁ EXISTIA (verificado antes de escrever) =====
-- `whatsapp_config` já tinha 4 colunas de template (`template_matricula_criada`,
-- `template_lembrete_aula`, `template_falta`, `template_lead_recontato`), lidas por
-- `src/lib/mensagens/mensagens.ts::enviarMensagem()` pra montar as 4 mensagens que JÁ SÃO REAIS
-- desde a Fase 13 (matrícula criada, lembrete de aula, falta, recontato de lead — com log em
-- `mensagens_enviadas`, retry, editor em /admin/mensagens/configuracao). Essa migration MIGRA o
-- conteúdo dessas 4 colunas pra linhas desta tabela nova (copia o valor salvo se não for nulo,
-- senão usa o padrão) — as colunas antigas ficam pra trás intactas (nenhuma é removida: várias
-- migrations dependem delas e `enviarMensagem()` só passa a ler daqui no código, não no SQL).
--
-- DIVERGÊNCIA DELIBERADA: os ids pedidos pra esses 4 templates ('matricula_criada',
-- 'lembrete_aula', 'falta_aula', 'recontato_lead') usam VARIÁVEIS PRÓPRIAS da tarefa (ex.:
-- {nome}, {curso}), mas estas 4 linhas específicas mantêm as variáveis LEGADAS
-- ({nome_aluno}, {nome_curso}, {nome_turma}, {data_aula}, {horario_aula}, {nome_lead},
-- {data_inicio_turma}) — são as mesmas que `enviarMensagem()` já substitui hoje; trocar o
-- vocabulário quebraria silenciosamente esses 4 envios (o texto ficaria com "{nome}" literal,
-- nunca substituído). Ver o relatório final para mais detalhes.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.whatsapp_templates (
  id text primary key check (
    id in (
      'matricula_criada', 'lembrete_aula', 'falta_aula', 'recontato_lead',
      'agendamento_lembrete', 'agendamento_cancelado', 'agendamento_falta',
      'cobranca_gerada', 'cobranca_atrasada_d1', 'cobranca_atrasada_d3',
      'cobranca_atrasada_d7', 'cobranca_atrasada_d15', 'lead_followup'
    )
  ),
  nome text not null,
  mensagem text not null check (char_length(btrim(mensagem)) between 1 and 1000),
  -- Inativo = o sistema usa a mensagem padrão do código (o envio continua acontecendo).
  ativo boolean not null default true,
  variaveis text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger on_whatsapp_templates_updated
  before update on public.whatsapp_templates
  for each row execute function public.handle_updated_at();

alter table public.whatsapp_templates enable row level security;

create policy "Admins gerenciam templates de WhatsApp"
  on public.whatsapp_templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- Sem delete pra authenticated: os 13 templates são fixos (o "restaurar padrão" é um update).
grant select, insert, update on public.whatsapp_templates to authenticated;
-- service_role bypassa RLS mas não os grants: o envio roda em crons/webhooks sem sessão.
grant select, insert, update, delete on public.whatsapp_templates to service_role;

-- ===== seed: 4 templates migrados de whatsapp_config (copia se preenchido, senão padrão) =====

insert into public.whatsapp_templates (id, nome, mensagem, variaveis)
select
  'matricula_criada',
  'Matrícula criada',
  coalesce(
    nullif(btrim(wc.template_matricula_criada), ''),
    'Olá, {nome_aluno}! Sua matrícula no curso {nome_curso} (turma {nome_turma}) foi confirmada. Sua primeira aula é em {data_aula} às {horario_aula}. Nos vemos lá!'
  ),
  array['nome_aluno', 'nome_curso', 'nome_turma', 'data_aula', 'horario_aula']
from public.whatsapp_config wc where wc.id = true
union all
select
  'lembrete_aula',
  'Lembrete de aula',
  coalesce(
    nullif(btrim(wc.template_lembrete_aula), ''),
    'Oi, {nome_aluno}! Lembrete: amanhã ({data_aula}) às {horario_aula} tem aula de {nome_curso}. Te esperamos!'
  ),
  array['nome_aluno', 'nome_curso', 'data_aula', 'horario_aula']
from public.whatsapp_config wc where wc.id = true
union all
select
  'falta_aula',
  'Falta em aula',
  coalesce(
    nullif(btrim(wc.template_falta), ''),
    'Olá, {nome_aluno}! Sentimos sua falta na aula de {nome_curso} em {data_aula}. Esperamos você na próxima!'
  ),
  array['nome_aluno', 'nome_curso', 'data_aula']
from public.whatsapp_config wc where wc.id = true
union all
select
  'recontato_lead',
  'Recontato de lead',
  coalesce(
    nullif(btrim(wc.template_lead_recontato), ''),
    'Olá, {nome_lead}! Temos novidades sobre o curso {nome_curso}, turma {nome_turma}, com início em {data_inicio_turma}. Quer saber mais?'
  ),
  array['nome_lead', 'nome_curso', 'nome_turma', 'data_inicio_turma']
from public.whatsapp_config wc where wc.id = true
on conflict (id) do nothing;

-- Se whatsapp_config ainda não tinha a linha singleton (banco muito antigo / migration fora de
-- ordem), garante os 4 templates mesmo assim, com o texto padrão.
insert into public.whatsapp_templates (id, nome, mensagem, variaveis) values
  ('matricula_criada', 'Matrícula criada',
   'Olá, {nome_aluno}! Sua matrícula no curso {nome_curso} (turma {nome_turma}) foi confirmada. Sua primeira aula é em {data_aula} às {horario_aula}. Nos vemos lá!',
   array['nome_aluno', 'nome_curso', 'nome_turma', 'data_aula', 'horario_aula']),
  ('lembrete_aula', 'Lembrete de aula',
   'Oi, {nome_aluno}! Lembrete: amanhã ({data_aula}) às {horario_aula} tem aula de {nome_curso}. Te esperamos!',
   array['nome_aluno', 'nome_curso', 'data_aula', 'horario_aula']),
  ('falta_aula', 'Falta em aula',
   'Olá, {nome_aluno}! Sentimos sua falta na aula de {nome_curso} em {data_aula}. Esperamos você na próxima!',
   array['nome_aluno', 'nome_curso', 'data_aula']),
  ('recontato_lead', 'Recontato de lead',
   'Olá, {nome_lead}! Temos novidades sobre o curso {nome_curso}, turma {nome_turma}, com início em {data_inicio_turma}. Quer saber mais?',
   array['nome_lead', 'nome_curso', 'nome_turma', 'data_inicio_turma'])
on conflict (id) do nothing;

-- ===== seed: 9 templates novos (eventos sem template antes) =====

insert into public.whatsapp_templates (id, nome, mensagem, variaveis) values
  (
    'agendamento_lembrete', 'Lembrete de agendamento',
    'Olá, {nome}! 👋 Passando para lembrar do seu agendamento {dia_semana}, dia {data} às {horario}. Até lá!',
    array['nome', 'data', 'horario', 'dia_semana']
  ),
  (
    'agendamento_cancelado', 'Agendamento cancelado',
    'Olá, {nome}. Seu agendamento do dia {data} às {horario} foi cancelado. {motivo}',
    array['nome', 'data', 'horario', 'motivo']
  ),
  (
    'agendamento_falta', 'Falta no agendamento',
    'Olá, {nome}, sentimos sua falta no agendamento de {data} às {horario}. Se quiser remarcar, é só nos chamar!',
    array['nome', 'data', 'horario']
  ),
  (
    'cobranca_gerada', 'Cobrança gerada',
    'Olá, {nome}! Sua cobrança de {valor} referente a {descricao} foi gerada, com vencimento em {vencimento}. Pagamento: {link_boleto}',
    array['nome', 'valor', 'vencimento', 'descricao', 'link_boleto', 'codigo_pix']
  ),
  (
    'cobranca_atrasada_d1', 'Cobrança atrasada (1-2 dias)',
    'Olá, {nome}, notamos que sua parcela de {valor} (vencimento {vencimento}) ainda não foi paga. Segue o link para pagamento: {link_boleto}',
    array['nome', 'valor', 'vencimento', 'dias_atraso', 'link_boleto']
  ),
  (
    'cobranca_atrasada_d3', 'Cobrança atrasada (3-6 dias)',
    'Olá, {nome}, sua parcela de {valor} está atrasada há {dias_atraso} dias (venceu em {vencimento}). Regularize para evitar transtornos: {link_boleto}',
    array['nome', 'valor', 'vencimento', 'dias_atraso', 'link_boleto']
  ),
  (
    'cobranca_atrasada_d7', 'Cobrança atrasada (7-14 dias)',
    '{nome}, sua parcela de {valor} está em atraso há {dias_atraso} dias. Por favor, regularize o quanto antes: {link_boleto}',
    array['nome', 'valor', 'vencimento', 'dias_atraso', 'link_boleto']
  ),
  (
    'cobranca_atrasada_d15', 'Cobrança atrasada (15+ dias)',
    '{nome}, sua parcela de {valor} está atrasada há {dias_atraso} dias. Entre em contato conosco urgentemente para evitar a suspensão do seu acesso: {link_boleto}',
    array['nome', 'valor', 'vencimento', 'dias_atraso', 'link_boleto']
  ),
  (
    'lead_followup', 'Follow-up de lead',
    'Olá, {nome}! 😊 Ainda podemos te ajudar com {curso_interesse} na {nome_escola}. Podemos conversar?',
    array['nome', 'curso_interesse', 'nome_escola', 'tentativa']
  )
on conflict (id) do nothing;
