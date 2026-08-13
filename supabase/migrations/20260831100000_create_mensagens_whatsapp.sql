-- Fase 13: mensagens automáticas via WhatsApp (Evolution API).
-- Enums prefixados "whatsapp" (não "mensagem" genérico) porque "Chat
-- interno" está no roadmap — evita colisão de nome mais adiante.

create type public.mensagem_whatsapp_tipo as enum ('matricula_criada', 'lembrete_aula', 'falta');
create type public.mensagem_whatsapp_status as enum ('pendente', 'enviado', 'falha');

-- ===== turmas: horário fixo da aula =====
-- Não existe horário em lugar nenhum do schema hoje (só datas, via
-- calendario_aulas_turma). As mensagens 1 e 2 precisam citar "data e
-- horário" — turma tem um horário único de aula (ex.: "toda terça e
-- quinta às 19h"), então entra como coluna opcional em turmas, não em
-- aulas (não há necessidade de horário variar aula a aula).

alter table public.turmas add column horario_aula time;

grant insert (horario_aula) on public.turmas to authenticated;
grant update (horario_aula) on public.turmas to authenticated;

-- ===== whatsapp_config: singleton, mesmo padrão de configuracoes/certificado_template =====

create table public.whatsapp_config (
  id boolean primary key default true,
  constraint whatsapp_config_singleton check (id),
  evolution_api_url text,
  evolution_instance_name text,
  evolution_api_key text,
  ativo boolean not null default false,
  template_matricula_criada text not null default
    'Olá, {nome_aluno}! Sua matrícula no curso {nome_curso} (turma {nome_turma}) foi confirmada. Sua primeira aula é em {data_aula} às {horario_aula}. Nos vemos lá!',
  template_lembrete_aula text not null default
    'Oi, {nome_aluno}! Lembrete: amanhã ({data_aula}) às {horario_aula} tem aula de {nome_curso}. Te esperamos!',
  template_falta text not null default
    'Olá, {nome_aluno}! Sentimos sua falta na aula de {nome_curso} em {data_aula}. Esperamos você na próxima!',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_config (id) values (true);

alter table public.whatsapp_config enable row level security;

create policy "Admins podem ver config do whatsapp"
  on public.whatsapp_config for select using (public.is_admin());

create policy "Admins podem atualizar config do whatsapp"
  on public.whatsapp_config for update using (public.is_admin()) with check (public.is_admin());

-- evolution_api_key propositalmente fora da lista de select — nem admin
-- lê o valor de volta pela API (a tela só mostra "configurada"/"não
-- configurada"). Só service_role, que faz a chamada real à Evolution
-- API, tem select da coluna.
grant select (
  evolution_api_url, evolution_instance_name, ativo,
  template_matricula_criada, template_lembrete_aula, template_falta,
  updated_by, updated_at
) on public.whatsapp_config to authenticated;

grant update (
  evolution_api_url, evolution_instance_name, evolution_api_key, ativo,
  template_matricula_criada, template_lembrete_aula, template_falta, updated_by
) on public.whatsapp_config to authenticated;

grant select, insert, update, delete on public.whatsapp_config to service_role;

-- ===== mensagens_enviadas: log/ledger, mesmo padrão imutável de resgates/certificados =====

create table public.mensagens_enviadas (
  id uuid primary key default gen_random_uuid(),
  tipo public.mensagem_whatsapp_tipo not null,
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aula_id uuid references public.aulas (id) on delete set null,
  telefone_destino text not null,
  mensagem_texto text not null,
  status public.mensagem_whatsapp_status not null default 'pendente',
  erro_detalhe text,
  -- Nullable e sem "default auth.uid()": o lembrete de aula é criado pelo
  -- cron job (Vercel Cron -> Route Handler -> service_role), sem sessão
  -- autenticada por trás — primeira tabela do projeto escrita por um
  -- processo sem ator humano. matricula_criada/falta, disparadas de
  -- dentro de uma Server Action, preenchem created_by explicitamente com
  -- o admin da sessão.
  created_by uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index mensagens_enviadas_matricula_id_idx on public.mensagens_enviadas (matricula_id);
create index mensagens_enviadas_status_idx on public.mensagens_enviadas (status) where status = 'falha';

-- Evita reenvio duplicado do mesmo lembrete se o cron rodar mais de uma
-- vez no mesmo dia (retry de infra, redeploy, etc.) — matricula_criada e
-- falta não precisam disso (cada uma já nasce de um evento único).
create unique index mensagens_enviadas_lembrete_uidx
  on public.mensagens_enviadas (matricula_id, aula_id)
  where tipo = 'lembrete_aula';

alter table public.mensagens_enviadas enable row level security;

create policy "Admins podem ver mensagens enviadas"
  on public.mensagens_enviadas for select using (public.is_admin());

-- Sem grant de insert/update pra authenticated: toda gravação (inclusive
-- o "reenviar" da tela de log) passa pelo client admin/service_role,
-- porque é o único jeito de ler evolution_api_key pra fazer a chamada.
grant select on public.mensagens_enviadas to authenticated;
grant select, insert, update, delete on public.mensagens_enviadas to service_role;

-- ===== grants pendentes pro client admin conseguir montar as mensagens =====
-- aulas/modulos nunca tinham sido concedidas a service_role (só entraram
-- em uso agora, pra compor "nome da aula"/"nome do curso" nos templates).
grant select, insert, update, delete on public.aulas to service_role;
grant select, insert, update, delete on public.modulos to service_role;
