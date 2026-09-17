-- Sistema de agendamentos (roadmap, item 2) — páginas públicas configuráveis
-- para leads marcarem visitas presenciais. Sem Evolution API por enquanto —
-- confirmação e lembrete D-1 são stubs (console.log).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- Páginas de agendamento configuráveis
create table public.agendamento_paginas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  descricao text,
  cor_primaria text not null default '#06b6d4',
  logo_url text,
  status text not null default 'ativa'
    check (status in ('ativa','inativa')),
  data_inicio date,
  data_fim date,
  vagas_por_horario integer not null default 1,
  duracao_minutos integer not null default 30,
  horarios_disponiveis jsonb not null default '[]'::jsonb,
  -- Ex: [{"dia_semana": 1, "horario": "09:00"}, {"dia_semana": 1, "horario": "10:00"}]
  dias_antecedencia_minimo integer not null default 1,
  campos_extras jsonb not null default '[]'::jsonb,
  -- Ex: [{"nome": "interesse", "tipo": "select", "opcoes": ["Informática", "Design"]}]
  mensagem_confirmacao text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agendamentos realizados
create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references public.agendamento_paginas (id) on delete cascade,
  nome text not null,
  whatsapp text not null,
  data_agendada date not null,
  horario text not null,
  campos_extras jsonb default '{}'::jsonb,
  status text not null default 'confirmado'
    check (status in ('confirmado','cancelado','realizado','faltou')),
  whatsapp_enviado boolean not null default false,
  lembrete_enviado boolean not null default false,
  created_at timestamptz not null default now()
);

-- Índice de apoio pra contagem de vagas ocupadas por dia/horário (ver
-- getContagemPorHorario em src/lib/agendamentos/agendamentos.ts) e pro cron
-- de lembrete D-1.
create index agendamentos_pagina_data_idx on public.agendamentos (pagina_id, data_agendada);

alter table public.agendamento_paginas enable row level security;
alter table public.agendamentos enable row level security;

create policy "Admins gerenciam páginas de agendamento"
  on public.agendamento_paginas for all using (public.is_admin());
create policy "Público pode ver páginas ativas"
  on public.agendamento_paginas for select using (status = 'ativa');

create policy "Admins gerenciam agendamentos"
  on public.agendamentos for all using (public.is_admin());
create policy "Público pode criar agendamentos"
  on public.agendamentos for insert with check (true);

-- DESVIO DO SQL ORIGINAL — motivo de segurança, não de gosto:
-- a policy "Público pode ver próprio agendamento" pedida originalmente era
-- `for select using (true)`, ou seja, sem filtro nenhum: qualquer visitante
-- anônimo conseguiria ler NOME e WHATSAPP de TODOS os agendamentos de TODAS
-- as páginas via API REST direta (não só "o próprio agendamento" — RLS não
-- tem como saber qual linha "pertence" a quem fez a requisição sem alguma
-- credencial, e não existe token de posse aqui). Removida por completo:
-- a tela de sucesso da página pública é montada só com os dados que o
-- próprio visitante acabou de digitar no formulário (nome, data, horário),
-- sem precisar reler a linha do banco — e a contagem de vagas ocupadas por
-- horário (pra desabilitar horário lotado) é calculada no server component
-- via client admin (service_role), do mesmo jeito que /captacao já lê
-- `cursos` sem abrir grant de anon pra essa tabela.

create trigger on_agendamento_paginas_updated
  before update on public.agendamento_paginas
  for each row execute function public.handle_updated_at();

grant select on public.agendamento_paginas to anon, authenticated;

-- DESVIO DO SQL ORIGINAL — mesmo motivo de segurança acima: o grant pedido
-- originalmente era `grant select, insert on public.agendamentos to anon,
-- authenticated`. Sem a policy de select pública, um grant de select pra
-- anon ficaria sem nenhuma policy que o autorize (RLS nega por padrão) — na
-- prática inofensivo, mas removido por clareza. `authenticated` mantém
-- select (a tela admin usa o client autenticado normal, não o admin, e
-- precisa desse grant pra "Admins gerenciam agendamentos" funcionar via
-- is_admin()); só `anon` fica restrito a insert.
grant select, insert on public.agendamentos to authenticated;
grant insert on public.agendamentos to anon;

grant select, insert, update, delete on public.agendamento_paginas to service_role;
grant select, insert, update, delete on public.agendamentos to service_role;
