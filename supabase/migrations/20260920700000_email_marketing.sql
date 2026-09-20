-- Módulo de E-mail Marketing (menu principal > E-mail Marketing): campanhas de e-mail
-- em massa para segmentos de alunos, com envio imediato ou agendado, pelo MESMO
-- provedor configurado em Configurações > E-mail (Resend, SMTP ou SendGrid).
--
-- email_campanhas_marketing — uma linha por campanha (nome, assunto, HTML, segmento,
-- status e contadores). Não confundir com "campanhas_marketing" (material gráfico/PDF).
--
-- email_campanhas_envios — uma linha por destinatário, criada ao INICIAR o envio (um
-- "retrato" da lista naquele momento). O envio é feito em lotes e pode levar mais de
-- uma execução (limite de tempo das funções): cada execução pega os `pendente` que
-- faltam, então o envio é retomável e nunca repete quem já recebeu.
--
-- Colunas além das pedidas:
--  - processando_ate (campanhas): trava curta de quem está enviando agora, pra duas
--    execuções simultâneas (cron + tela) nunca enviarem o mesmo lote em dobro.
--  - unique (campanha_id, email) (envios): o mesmo e-mail nunca entra duas vezes.
--
-- Sem "created_by" em email_campanhas_envios (convenção CLAUDE.md): linhas geradas pelo
-- servidor (inclusive pelo cron, sem sessão). Em email_campanhas_marketing, escrita só
-- por admin, o created_by vale normalmente.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.email_campanhas_marketing (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  assunto text not null,
  corpo_html text not null,
  segmento text not null default 'todos'
    check (segmento in ('todos', 'ativos', 'inativos', 'curso_especifico', 'com_cobranca_atrasada', 'sem_matricula')),
  -- Só usado quando segmento = 'curso_especifico'.
  curso_id uuid references public.cursos (id) on delete set null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendada', 'enviando', 'enviada', 'cancelada')),
  agendada_para timestamptz,
  total_destinatarios integer not null default 0,
  total_enviados integer not null default 0,
  total_erros integer not null default 0,
  processando_ate timestamptz,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_campanhas_curso_no_segmento
    check (segmento <> 'curso_especifico' or curso_id is not null),
  constraint email_campanhas_agendada_tem_data
    check (status <> 'agendada' or agendada_para is not null)
);

-- Cron: "agendadas vencidas" e "enviando".
create index email_campanhas_status_idx on public.email_campanhas_marketing (status, agendada_para);

create trigger on_email_campanhas_marketing_updated
  before update on public.email_campanhas_marketing
  for each row execute function public.handle_updated_at();

create table public.email_campanhas_envios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.email_campanhas_marketing (id) on delete cascade,
  aluno_id uuid references public.alunos (id) on delete set null,
  email text not null,
  nome text,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'erro')),
  erro text,
  enviado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campanha_id, email)
);

-- Próximos pendentes de uma campanha (a query do envio em lotes) e a tela de detalhes.
create index email_campanhas_envios_campanha_status_idx on public.email_campanhas_envios (campanha_id, status);

-- ===== RLS: só admin =====

alter table public.email_campanhas_marketing enable row level security;
alter table public.email_campanhas_envios enable row level security;

create policy "Admins gerenciam campanhas de e-mail"
  on public.email_campanhas_marketing for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins gerenciam envios de campanhas de e-mail"
  on public.email_campanhas_envios for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.email_campanhas_marketing to authenticated;
grant select, insert, update, delete on public.email_campanhas_envios to authenticated;
-- O envio (Server Action em segundo plano e cron) roda com o client admin.
grant select, insert, update, delete on public.email_campanhas_marketing to service_role;
grant select, insert, update, delete on public.email_campanhas_envios to service_role;
