-- Templates de SMS editáveis + configuração da recuperação escalonada de leads
-- (Configurações > Apps > IntegraX SMS > abas "Templates" e "Recuperação Escalonada").
--
-- Complementa 20260920300000_integracoes_sms_config.sql (token/ativo da IntegraX); NÃO altera
-- nada dela. As mensagens de fábrica dos 3 eventos que já disparam SMS (acesso/matrícula,
-- cobrança e pagamento confirmado) são EXATAMENTE as que já estavam no código
-- (src/lib/integrax/notificacoes.ts), agora com placeholders — então aplicar esta migration não
-- muda o texto de nenhum SMS existente. O código mantém as mesmas mensagens como padrão e as usa
-- quando o template está inativo ou a tabela indisponível.
--
-- Sem "created_by" (convenção padrão, CLAUDE.md): templates e configuração são linhas semeadas por
-- esta migration (sem auth.uid()) — mesma exceção de integracoes_sms_config/gateways_config.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== sms_templates =====

create table public.sms_templates (
  id text primary key check (
    id in (
      'acesso', 'cobranca', 'pix_gerado', 'pagamento_confirmado',
      'agendamento_lembrete', 'lead_confirmacao'
    )
  ),
  nome text not null,
  -- 160 = limite de um SMS GSM-7 (mesmo teto do enviarSMS).
  mensagem text not null check (char_length(btrim(mensagem)) between 1 and 160),
  -- Inativo = o sistema usa a mensagem padrão do código (o SMS continua sendo enviado).
  ativo boolean not null default true,
  -- Placeholders disponíveis (chaves, sem chaves {}), só para consulta/exibição.
  variaveis text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger on_sms_templates_updated
  before update on public.sms_templates
  for each row execute function public.handle_updated_at();

alter table public.sms_templates enable row level security;

create policy "Admins gerenciam templates de SMS"
  on public.sms_templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- Sem delete pra authenticated: os 6 templates são fixos (o "restaurar padrão" é um update).
grant select, insert, update on public.sms_templates to authenticated;
-- service_role bypassa RLS mas não os grants: o envio de SMS roda em webhooks/crons sem sessão.
grant select, insert, update, delete on public.sms_templates to service_role;

insert into public.sms_templates (id, nome, mensagem, variaveis) values
  (
    'acesso',
    'Acesso / matrícula criada',
    'GENEZI: Ola, {nome_aluno}! Matricula confirmada em {nome_curso}. Acesse a plataforma com o e-mail {email}.',
    array['nome_aluno', 'nome_curso', 'email', 'nome_escola']
  ),
  (
    'cobranca',
    'Cobrança gerada',
    'GENEZI: {nome_aluno}, parcela {parcela} de {valor} vence em {vencimento}. Curso: {nome_curso}.',
    array['nome_aluno', 'parcela', 'valor', 'vencimento', 'nome_curso', 'nome_escola']
  ),
  (
    'pix_gerado',
    'PIX gerado',
    'GENEZI: {nome_aluno}, o PIX da parcela {parcela} ({valor}) do curso {nome_curso} foi gerado. Vence em {vencimento}.',
    array['nome_aluno', 'parcela', 'valor', 'vencimento', 'nome_curso', 'nome_escola']
  ),
  (
    'pagamento_confirmado',
    'Pagamento confirmado',
    'GENEZI: Ola, {nome_aluno}! Recebemos o pagamento da parcela {parcela} ({valor}) de {nome_curso}. Obrigado!',
    array['nome_aluno', 'parcela', 'valor', 'nome_curso', 'nome_escola']
  ),
  (
    'agendamento_lembrete',
    'Lembrete de agendamento',
    'GENEZI: {nome_cliente}, lembrete: seu agendamento e amanha, dia {data} as {hora}. Ate la!',
    array['nome_cliente', 'data', 'hora', 'nome_escola']
  ),
  (
    'lead_confirmacao',
    'Confirmação de interesse (lead)',
    'GENEZI: Ola, {nome_cliente}! Recebemos seu interesse em {curso_interesse}. Em breve entraremos em contato.',
    array['nome_cliente', 'curso_interesse', 'nome_escola']
  )
on conflict (id) do nothing;

-- ===== sms_recuperacao_config (singleton) =====
-- Recuperação escalonada: sequência automática de SMS para LEADS que se cadastraram mas ainda não
-- se matricularam. O cron (src/app/api/cron/sms-recuperacao) roda 1x por dia (plano Hobby).

create table public.sms_recuperacao_config (
  id uuid primary key default '00000000-0000-0000-0000-000000000002'::uuid
    check (id = '00000000-0000-0000-0000-000000000002'::uuid),
  ativo boolean not null default false,
  -- Até quando (após o cadastro do lead) as etapas podem ser enviadas. A tela trabalha em dias
  -- (1 a 7) e grava em horas.
  prazo_maximo_horas integer not null default 48 check (prazo_maximo_horas between 1 and 168),
  -- Array de { "horas": número, "mensagem": texto }, ordenado por horas (máximo 5 etapas).
  etapas jsonb not null default '[]'::jsonb check (
    jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) <= 5
  ),
  -- Quando a recuperação foi LIGADA pela última vez. O cron só considera leads criados DEPOIS
  -- disso: ligar o recurso não dispara SMS em massa para leads antigos que nunca foram avisados
  -- de que receberiam mensagens. (Coluna além das pedidas.)
  ativado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_sms_recuperacao_config_updated
  before update on public.sms_recuperacao_config
  for each row execute function public.handle_updated_at();

alter table public.sms_recuperacao_config enable row level security;

create policy "Admins gerenciam recuperação por SMS"
  on public.sms_recuperacao_config for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.sms_recuperacao_config to authenticated;
grant select, insert, update, delete on public.sms_recuperacao_config to service_role;

-- Linha inicial (desligada) com 3 etapas padrão dentro do prazo padrão de 48h.
insert into public.sms_recuperacao_config (id, ativo, prazo_maximo_horas, etapas) values (
  '00000000-0000-0000-0000-000000000002',
  false,
  48,
  '[
    {"horas": 3, "mensagem": "{nome_cliente}, aqui e da {nome_escola}! Vimos seu interesse em {curso_interesse}. Agende uma conversa: {link_agendamento}"},
    {"horas": 24, "mensagem": "{nome_cliente}, ainda tem interesse em {curso_interesse}? As vagas sao limitadas. Fale com a gente: {link_agendamento}"},
    {"horas": 48, "mensagem": "Ultima chance, {nome_cliente}! Garanta sua vaga em {curso_interesse} na {nome_escola}. Agende aqui: {link_agendamento}"}
  ]'::jsonb
)
on conflict (id) do nothing;
