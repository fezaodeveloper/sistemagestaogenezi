-- Banco de campanhas de marketing (roadmap Grupo A, item 4).
--
-- Timestamp ajustado: a TAREFA pedia 20260917400000, mas esse slot já foi
-- usado por 20260917400000_configuracoes_conecta_habilitado.sql (item 6),
-- mostrada na mesma mensagem — as duas não podem ocupar o mesmo timestamp.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.campanhas_marketing (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  como_fazer text,
  status text not null default 'ativa'
    check (status in ('ativa','inativa','planejada')),
  data_inicio date,
  data_fim date,
  orcamento_trafego numeric,
  orcamento_impressao numeric,
  links jsonb default '[]'::jsonb,
  foto_url text,
  foto_path text,
  tags text[],
  -- A TAREFA pedia "created_by uuid references public.profiles(id)"
  -- (nullable, sem default) — ajustado pra "not null default auth.uid()",
  -- padrão obrigatório do projeto pra toda tabela nova (CLAUDE.md). Sem
  -- "on delete cascade": só admin cria campanha, e conta admin nunca é
  -- excluída pelo app (mesmo raciocínio já documentado em CLAUDE.md).
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campanhas_marketing enable row level security;
create policy "Admins gerenciam campanhas"
  on public.campanhas_marketing for all using (public.is_admin());
grant select, insert, update, delete on public.campanhas_marketing to authenticated;
grant select, insert, update, delete on public.campanhas_marketing to service_role;

create trigger on_campanhas_marketing_updated
  before update on public.campanhas_marketing
  for each row execute function public.handle_updated_at();

-- ===== Bucket de fotos das campanhas =====
-- Não pedido explicitamente na TAREFA, mas necessário pro item "Foto:
-- upload simples" do dialog de criar/editar campanha. Mesmo padrão já usado
-- em "login-banners", "escola-logo" etc.: bucket público (a foto só ilustra
-- o card, sem dado sensível), upload/gestão restritos a admin via policies
-- em storage.objects.

insert into storage.buckets (id, name, public) values ('campanhas-marketing', 'campanhas-marketing', true);

create policy "Admins enviam fotos de campanhas"
  on storage.objects for insert
  with check (bucket_id = 'campanhas-marketing' and public.is_admin());
create policy "Admins atualizam fotos de campanhas"
  on storage.objects for update
  using (bucket_id = 'campanhas-marketing' and public.is_admin());
create policy "Admins excluem fotos de campanhas"
  on storage.objects for delete
  using (bucket_id = 'campanhas-marketing' and public.is_admin());
