-- PARTE 0 (diagnóstico) — email_descadastros e alunos.email_marketing_ativo só existem no
-- código da migration 20260920800000_email_descadastros.sql, que está marcada "NÃO APLICADA"
-- no próprio cabeçalho desde que foi escrita. Nenhuma outra migration cria ou referencia essas
-- duas coisas. Sem acesso ao banco de produção neste ambiente não dá pra confirmar com
-- `SELECT COUNT(*)` se já foi aplicada (ver resumo da tarefa) — mas o próprio código já
-- pressupõe que sim: getDestinatarios (src/lib/email/marketing.ts) lê email_descadastros
-- incondicionalmente. Se a tabela não existir, o bug não é só a tela /descadastros: TODA
-- campanha de e-mail falha ao iniciar (iniciarEnvioCampanha já tem o mesmo texto de erro
-- hipotético "a migration email_descadastros foi aplicada?").
--
-- Este bloco repete exatamente o conteúdo de 20260920800000 (idempotente, IF NOT EXISTS em
-- tudo) — seguro de rodar tanto se a migration original nunca foi aplicada (resolve o bug)
-- quanto se já foi (não faz nada). Não é uma correção de bug no SQL original, que já estava
-- correto — é só uma segunda chance de aplicar o que faltou, sem duplicar o arquivo antigo.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.alunos
  add column if not exists email_marketing_ativo boolean not null default true;

create table if not exists public.email_descadastros (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  aluno_id uuid references public.alunos (id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists email_descadastros_created_at_idx on public.email_descadastros (created_at desc);

alter table public.email_descadastros enable row level security;

drop policy if exists "Admins leem descadastros de e-mail" on public.email_descadastros;
create policy "Admins leem descadastros de e-mail"
  on public.email_descadastros for select
  using (public.is_admin());

grant select on public.email_descadastros to authenticated;
grant select, insert, update, delete on public.email_descadastros to service_role;

-- ===== PARTE 2 (TAREFA) — novos segmentos de destinatário para leads =====
--
-- email_campanhas_marketing.segmento tem CHECK fixo (20260920700000_email_marketing.sql) —
-- precisa ser recriado pra aceitar os 3 valores novos.
alter table public.email_campanhas_marketing drop constraint if exists email_campanhas_marketing_segmento_check;
alter table public.email_campanhas_marketing
  add constraint email_campanhas_marketing_segmento_check
  check (segmento in (
    'todos', 'ativos', 'inativos', 'curso_especifico', 'com_cobranca_atrasada', 'sem_matricula',
    'leads_campanha', 'leads_ativos', 'leads_curso'
  ));

-- curso_id (coluna já existente) é reaproveitado pelo segmento 'leads_curso' (mutuamente
-- exclusivo com 'curso_especifico') — leads_campanha precisa de um id DIFERENTE
-- (campanhas_marketing.id, não cursos.id), daí a coluna nova.
alter table public.email_campanhas_marketing
  add column if not exists leads_campanha_id uuid references public.campanhas_marketing (id) on delete set null;

-- ===== PARTE 3 (TAREFA) — bucket de imagens do editor visual de e-mail =====
--
-- Não existia (confirmado: nenhuma migration cria "email-assets", PERGUNTA DE FATO 3). Público
-- (mesmo padrão de "campanhas-marketing"/"campanha-paginas" já existentes): as imagens precisam
-- carregar em qualquer cliente de e-mail, de destinatários sem sessão nenhuma no projeto.
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do nothing;

drop policy if exists "Admins enviam imagens de e-mail" on storage.objects;
create policy "Admins enviam imagens de e-mail"
  on storage.objects for insert
  with check (bucket_id = 'email-assets' and public.is_admin());

drop policy if exists "Admins atualizam imagens de e-mail" on storage.objects;
create policy "Admins atualizam imagens de e-mail"
  on storage.objects for update
  using (bucket_id = 'email-assets' and public.is_admin());

drop policy if exists "Admins excluem imagens de e-mail" on storage.objects;
create policy "Admins excluem imagens de e-mail"
  on storage.objects for delete
  using (bucket_id = 'email-assets' and public.is_admin());
