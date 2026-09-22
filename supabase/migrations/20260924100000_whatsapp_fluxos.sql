-- GênZap Fase 3 — editor visual de fluxos de WhatsApp (Configurações não — página própria
-- /admin/whatsapp-fluxos). Fluxos PERSONALIZADOS, adicionais aos 13 templates/eventos
-- automáticos já existentes (Fases 1-2, intocados por esta migration).
--
-- ===== O QUE JÁ EXISTIA (verificado antes de escrever) =====
-- `whatsapp_config` (conexão), `whatsapp_templates` (13 templates) e `src/lib/whatsapp/eventos.ts`
-- (9 funções de envio automático) já existem e continuam exatamente como estão — esta migration
-- só ACRESCENTA duas tabelas novas, sem tocar nas anteriores.
--
-- Formato de `nos` (documentado aqui pra quem for ler os dados direto no banco):
--   [{ "id": "n1", "tipo": "gatilho|mensagem|aguardar|condicao|fim",
--      "posicao": {"x": 100, "y": 100}, "dados": {...}, "proximos": ["n2"] }, ...]
--   - "gatilho": único, sempre o primeiro nó (dados: { evento }).
--   - "mensagem": dados: { texto }. proximos[0] = próximo nó.
--   - "aguardar": dados: { segundos }. proximos[0] = próximo nó.
--   - "condicao": dados: { campo, operador, valor }. proximos[0] = destino se VERDADEIRO,
--     proximos[1] = destino se FALSO (convenção posicional — ver src/lib/whatsapp/fluxos.ts).
--   - "fim": dados: {}. proximos = [] (nunca tem sucessor).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.whatsapp_fluxos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  gatilho text not null check (
    gatilho in (
      'matricula_criada', 'agendamento_criado', 'lead_criado',
      'pagamento_recebido', 'cobranca_atrasada', 'manual'
    )
  ),
  ativo boolean not null default false,
  nos jsonb not null default '[]'::jsonb check (jsonb_typeof(nos) = 'array'),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_fluxos_gatilho_idx on public.whatsapp_fluxos (gatilho) where ativo;

create trigger on_whatsapp_fluxos_updated
  before update on public.whatsapp_fluxos
  for each row execute function public.handle_updated_at();

alter table public.whatsapp_fluxos enable row level security;

create policy "Admins gerenciam fluxos de WhatsApp"
  on public.whatsapp_fluxos for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.whatsapp_fluxos to authenticated;
grant select, insert, update, delete on public.whatsapp_fluxos to service_role;

-- ===== whatsapp_fluxos_execucoes =====
-- Uma linha por execução (uma entidade passando pelo fluxo). "em_andamento" com
-- retomar_em preenchido = parado num nó "aguardar", esperando o cron retomar (ver
-- src/app/api/cron/whatsapp-fluxos/route.ts). Sem retomar_em = rodando agora mesmo (síncrono,
-- dentro da própria chamada que disparou).

create table public.whatsapp_fluxos_execucoes (
  id uuid primary key default gen_random_uuid(),
  fluxo_id uuid not null references public.whatsapp_fluxos (id) on delete cascade,
  entidade_tipo text check (entidade_tipo in ('lead', 'aluno', 'agendamento')),
  entidade_id uuid,
  telefone text not null,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluido', 'erro', 'cancelado')),
  -- id (texto) do nó onde a execução está agora ou vai retomar — não é mais "integer" como no
  -- rascunho original: os nós são identificados por string ("n1", "n2", ...), não por posição
  -- numérica fixa (o admin pode reordenar/inserir nós no meio do fluxo sem invalidar execuções
  -- em andamento). Ver divergência no relatório final.
  no_atual text,
  -- Preenchido só quando parada num nó "aguardar"; o cron busca por aqui.
  retomar_em timestamptz,
  variaveis jsonb not null default '{}'::jsonb,
  erro_detalhe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_fluxos_execucoes_fluxo_idx on public.whatsapp_fluxos_execucoes (fluxo_id, created_at desc);
create index whatsapp_fluxos_execucoes_retomar_idx
  on public.whatsapp_fluxos_execucoes (retomar_em)
  where status = 'em_andamento' and retomar_em is not null;

create trigger on_whatsapp_fluxos_execucoes_updated
  before update on public.whatsapp_fluxos_execucoes
  for each row execute function public.handle_updated_at();

alter table public.whatsapp_fluxos_execucoes enable row level security;

create policy "Admins gerenciam execucoes de fluxos de WhatsApp"
  on public.whatsapp_fluxos_execucoes for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.whatsapp_fluxos_execucoes to authenticated;
grant select, insert, update, delete on public.whatsapp_fluxos_execucoes to service_role;
