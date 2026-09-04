-- TAREFA 11/12 — tipos de prêmio (físico/digital/híbrido) + histórico de
-- entregas. Mostrada para revisão, NÃO aplicada nesta rodada.
--
-- Duas adições em relação ao SQL originalmente pedido:
-- 1. Bucket 'premios-digitais' + policies de storage — citado na TAREFA
--    11B ("Bucket: 'premios-digitais' (criar na migration)") mas não
--    incluído no SQL da TAREFA 11A. Criado como bucket PRIVADO (não
--    público como 'premios', que só guarda foto de catálogo): o arquivo
--    de entrega digital é o próprio produto pago com créditos, mesmo
--    critério de conteúdo protegido já usado para 'materiais' e
--    'notas-fiscais' (ver CLAUDE.md) — nunca deve ter URL pública
--    permanente. A entrega ao aluno usa signed URL gerada sob demanda
--    (ver src/app/aluno/creditos/actions.ts).
-- 2. Nenhuma policy de INSERT/UPDATE em entregas_premios para o próprio
--    aluno: o código que cria/atualiza essas linhas ao resgatar (TAREFA
--    12A) roda com o client admin (service_role, que só precisa do GRANT
--    já previsto abaixo), não com o client autenticado do aluno — mesmo
--    padrão de processarEvento() em src/lib/automacoes/motor.ts. Assim
--    entregas_premios fica com a política pretendida (aluno só enxerga,
--    nunca edita, o próprio histórico de entrega).

alter table public.premios
  add column if not exists tipo text not null default 'fisico'
    check (tipo in ('fisico', 'digital', 'hibrido')),
  add column if not exists entrega_email_conteudo text,
  add column if not exists entrega_arquivo_url text,
  add column if not exists entrega_arquivo_path text,
  add column if not exists entrega_whatsapp_mensagem text;

grant update (
  tipo, entrega_email_conteudo, entrega_arquivo_url,
  entrega_arquivo_path, entrega_whatsapp_mensagem
) on public.premios to authenticated;
grant insert (
  tipo, entrega_email_conteudo, entrega_arquivo_url,
  entrega_arquivo_path, entrega_whatsapp_mensagem
) on public.premios to authenticated;

-- ===== Bucket de arquivos de entrega digital (privado) =====

insert into storage.buckets (id, name, public) values ('premios-digitais', 'premios-digitais', false);

create policy "Admins gerenciam arquivos de premios digitais"
  on storage.objects for all
  using (bucket_id = 'premios-digitais' and public.is_admin())
  with check (bucket_id = 'premios-digitais' and public.is_admin());

-- ===== Tabela de entregas de prêmios (histórico) =====

create table public.entregas_premios (
  id uuid primary key default gen_random_uuid(),
  resgate_id uuid not null references public.resgates (id) on delete cascade,
  premio_id uuid not null references public.premios (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  tipo_entrega text not null
    check (tipo_entrega in ('email', 'whatsapp', 'fisico', 'manual')),
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'entregue', 'falhou')),
  enviado_em timestamptz,
  entregue_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entregas_premios enable row level security;

create policy "Admins gerenciam entregas"
  on public.entregas_premios for all using (public.is_admin());
create policy "Aluno ve propria entrega"
  on public.entregas_premios for select using (aluno_id = auth.uid());

grant select on public.entregas_premios to authenticated;
grant insert, update on public.entregas_premios to authenticated;
grant select, insert, update, delete on public.entregas_premios to service_role;

create trigger on_entregas_premios_updated
  before update on public.entregas_premios
  for each row execute function public.handle_updated_at();
