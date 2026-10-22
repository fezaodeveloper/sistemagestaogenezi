-- NÃO APLICADA — aplicar manualmente no SQL Editor

-- Tabela de regras de recorrência para notificações configuráveis. Vercel Hobby: cron roda
-- 1x/dia no máximo — recorrência semanal/quinzenal/mensal é simulada no banco via
-- proxima_execucao (o cron diário só processa regras com proxima_execucao <= hoje).
--
-- Desvios do SQL original da tarefa, por convenção já documentada no CLAUDE.md deste projeto
-- (aplicada a toda tabela nova, sem excessão): adicionado created_by (quem criou a regra — só
-- admin cria/edita isso, então o FK padrão sem "on delete cascade" é seguro), RLS habilitado
-- com policy explícita, e grants explícitos por role (nenhuma tabela nova depende dos grants
-- default do Postgres neste projeto).
create table if not exists public.regras_notificacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  -- Tipos: 'lembrete_aula' | 'whatsapp_personalizado' | 'telegram_personalizado'
  nome text not null,
  ativo boolean not null default true,
  recorrencia text not null default 'diario',
  -- Valores: 'diario' | 'semanal' | 'quinzenal' | 'mensal'
  dia_semana integer,
  -- 0=Dom, 1=Seg ... 6=Sab (usado quando recorrencia='semanal')
  hora_envio integer not null default 8,
  -- Hora BRT (0-23) — informativo no plano Hobby (cron é fixo 1x/dia, sempre às 8h)
  proxima_execucao date not null default current_date,
  ultima_execucao timestamptz,
  mensagem_template text,
  -- Para tipos personalizados: template da mensagem
  destino text not null default 'whatsapp',
  -- 'whatsapp' | 'telegram' | 'ambos'
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_regras_notificacao_ativo
  on public.regras_notificacao (ativo, proxima_execucao);

comment on table public.regras_notificacao is
  'Regras de recorrência para notificações automáticas.
   No Vercel Hobby, o cron roda 1x/dia — proxima_execucao controla quando a regra dispara.';

alter table public.regras_notificacao enable row level security;

create policy "Admins gerenciam regras de notificação"
  on public.regras_notificacao for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.regras_notificacao to authenticated;
grant select, insert, update, delete on public.regras_notificacao to service_role;

-- Reaproveita a função já usada em outras tabelas (ver create_cursos, create_matriculas, etc.).
create trigger on_regras_notificacao_updated
  before update on public.regras_notificacao
  for each row execute function public.handle_updated_at();
