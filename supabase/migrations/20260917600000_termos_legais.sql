-- Conteúdo editável (via editor rico) das 4 páginas legais do portal do
-- aluno — roadmap "menu LEGAL" do admin.
--
-- Sem "created_by" (convenção padrão de toda tabela nova, CLAUDE.md): as 4
-- linhas são semente fixa desta migration (sem sessão autenticada por trás,
-- "auth.uid()" seria null e quebraria um "not null default auth.uid()") e a
-- própria tabela já carrega uma coluna de auditoria equivalente
-- ("atualizado_por", preenchida pela Server Action a cada edição) — mesma
-- exceção já documentada em conecta_cidades (linhas de referência, sem
-- created_by) e leads.created_by (nullable, mesma razão de não ter sessão
-- por trás do insert).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.termos_legais (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique
    check (chave in ('privacidade','termos','lgpd','imagem')),
  titulo text not null,
  conteudo text not null default '',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id)
);

alter table public.termos_legais enable row level security;
create policy "Admins gerenciam termos"
  on public.termos_legais for all using (public.is_admin());
-- Mesmo idioma já usado em outras tabelas de referência lidas por qualquer
-- usuário logado (configuracoes, badges, cronograma_aulas): "using (true)" +
-- o GRANT abaixo (só para "authenticated", sem grant pra "anon") já basta
-- pra restringir a leitura a quem tem sessão — não precisa repetir
-- auth.role() = 'authenticated' na própria policy.
create policy "Alunos veem termos"
  on public.termos_legais for select
  using (true);

-- A TAREFA só concedia SELECT a "authenticated" — mas a Server Action que
-- salva o conteúdo (salvarTermoLegal) roda no client autenticado normal
-- (não o client admin/service_role), então precisa de GRANT de UPDATE nas
-- colunas que o admin de fato edita. Sem isso a policy "Admins gerenciam
-- termos" nunca teria efeito prático (RLS libera, mas o grant bloqueia
-- antes) — mesmo tipo de lacuna já corrigida em conecta_cidades e
-- campanhas_marketing.
grant select on public.termos_legais to authenticated;
grant update (conteudo, titulo, atualizado_em, atualizado_por) on public.termos_legais to authenticated;
grant select, insert, update, delete on public.termos_legais to service_role;

-- Seed com conteúdo atual das páginas estáticas — conteúdo vazio de
-- propósito: as páginas do aluno (src/app/aluno/legal/*/page.tsx) já
-- caem no fallback com o texto atual quando "conteudo" está vazio, então
-- não é preciso duplicar o texto inteiro dentro do SQL. Um admin substitui
-- pelo texto definitivo (com formatação rica) na tela nova quando quiser.
insert into public.termos_legais (chave, titulo, conteudo) values
('privacidade', 'Política de Privacidade', ''),
('termos', 'Termos de Uso', ''),
('lgpd', 'Lei Geral de Proteção de Dados (LGPD)', ''),
('imagem', 'Termo de Uso de Imagem', '');
