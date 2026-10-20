-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Assinatura do Termo de Uso de Imagem SEM login (validação por CPF, fluxo público em
-- /termo-imagem/[matriculaId]/assinar) — mesmo modelo de termos_imagem_assinados espelha
-- contratos_assinados (cpf_assinante/tipo_assinante, 20261020130000_contrato_assinatura_cpf.sql).
--
-- Sem "created_by" — mesma exceção documentada em termos_legais
-- (20260917600000_termos_legais.sql): a única escrita nesta tabela vem do fluxo público sem
-- sessão (via createAdminClient()), "auth.uid()" seria null e quebraria um "not null default
-- auth.uid()".

create table public.termos_imagem_assinados (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  cpf_assinante text not null,
  tipo_assinante text not null check (tipo_assinante in ('aluno', 'responsavel')),
  aceito_em timestamptz not null default now(),
  aceito_ip text,
  -- Snapshot do texto do termo (termos_legais.conteudo) no momento do aceite — pra auditoria,
  -- caso o admin edite o termo depois.
  versao_texto text,
  created_at timestamptz not null default now(),
  unique (matricula_id)
);

alter table public.termos_imagem_assinados enable row level security;

create policy "Admins veem todos os termos de imagem"
  on public.termos_imagem_assinados for all using (public.is_admin());

create policy "Aluno ve proprio termo de imagem"
  on public.termos_imagem_assinados for select using (aluno_id = auth.uid());

grant select on public.termos_imagem_assinados to authenticated;
grant select, insert, update, delete on public.termos_imagem_assinados to service_role;
