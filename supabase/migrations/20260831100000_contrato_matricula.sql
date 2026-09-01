-- Contrato de matrícula em PDF — mesmo padrão do certificado (template
-- editável + geração de PDF), com aceite digital pelo aluno.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Template único do contrato (singleton) =====

create table public.contrato_template (
  id uuid primary key default gen_random_uuid(),
  -- Texto do contrato em formato JSON (Tiptap) com variáveis
  conteudo jsonb not null default '{}',
  -- Texto simples para fallback
  conteudo_texto text,
  -- Configurações visuais
  cor_texto text not null default '#000000',
  -- Metadados
  created_by uuid not null references public.profiles (id) default auth.uid(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Só pode haver UM template de contrato (mesma ideia do singleton por
-- `id boolean primary key default true` usado em certificado_template, só
-- que via índice único parcial — aqui o id é uuid, não boolean).
create unique index contrato_template_singleton
  on public.contrato_template ((true));

alter table public.contrato_template enable row level security;

create policy "Admins gerenciam template de contrato"
  on public.contrato_template for all using (public.is_admin());
create policy "Alunos podem ver template de contrato"
  on public.contrato_template for select
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'aluno'
  ));

grant select on public.contrato_template to authenticated;
grant insert (conteudo, conteudo_texto, cor_texto, created_by) on public.contrato_template to authenticated;
grant update (conteudo, conteudo_texto, cor_texto, updated_by) on public.contrato_template to authenticated;
grant select, insert, update, delete on public.contrato_template to service_role;

create trigger on_contrato_template_updated
  before update on public.contrato_template
  for each row execute function public.handle_updated_at();

-- ===== Contratos assinados por aluno/matrícula =====

create table public.contratos_assinados (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  -- Snapshot do conteúdo no momento da geração (Tarefa 5) — PDF completo,
  -- não recalculado depois mesmo se o template mudar.
  conteudo_pdf_base64 text,
  -- Aceite digital
  aceito_em timestamptz,
  aceito_ip text,
  -- Status
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado')),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matricula_id)
);

alter table public.contratos_assinados enable row level security;

create policy "Admins veem todos os contratos"
  on public.contratos_assinados for all using (public.is_admin());
create policy "Aluno ve proprio contrato"
  on public.contratos_assinados for select
  using (aluno_id = auth.uid());
create policy "Aluno pode assinar proprio contrato"
  on public.contratos_assinados for update
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

grant select on public.contratos_assinados to authenticated;
grant insert (matricula_id, aluno_id, conteudo_pdf_base64, status, created_by)
  on public.contratos_assinados to authenticated;
grant update (aceito_em, aceito_ip, status)
  on public.contratos_assinados to authenticated;
grant select, insert, update, delete on public.contratos_assinados to service_role;

create trigger on_contratos_assinados_updated
  before update on public.contratos_assinados
  for each row execute function public.handle_updated_at();

-- gerarContratoPdf (src/lib/contratos/pdf.tsx) roda com o client admin
-- (service_role) e precisa ler responsaveis (dados do responsável legal,
-- quando o aluno é menor) e configuracoes (nome/logo da escola) — nenhuma
-- das duas tinha grant pra service_role até aqui (mesma pendência já
-- documentada no CLAUDE.md para outras tabelas).
grant select, insert, update, delete on public.responsaveis to service_role;
grant select, insert, update, delete on public.configuracoes to service_role;
