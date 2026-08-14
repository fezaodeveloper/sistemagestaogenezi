-- Fase 11: chat interno (admin ↔ aluno, 1:1, caixa de entrada
-- compartilhada entre admins) — restrito a alunos com matrícula ativa em
-- curso presencial ou híbrido (mesmo critério do streak/gamificação:
-- tipo <> 'ead'). Realtime habilitado nas duas tabelas.

-- ===== conversas: uma por aluno (não por par admin+aluno — qualquer =====
-- ===== admin vê/responde qualquer conversa, é uma inbox compartilhada) =====

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references public.alunos (id) on delete cascade,
  ultima_mensagem_em timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_conversas_updated
  before update on public.conversas
  for each row execute function public.handle_updated_at();

alter table public.conversas enable row level security;

create policy "Admins podem ver conversas"
  on public.conversas for select using (public.is_admin());

create policy "Alunos podem ver a propria conversa"
  on public.conversas for select using (aluno_id = auth.uid());

-- Elegibilidade (matrícula ativa em curso não-EAD) reforçada aqui também,
-- não só na Server Action — mesmo espírito de "reforça no servidor a
-- mesma regra da UI" já usado em toggleAulaConcluida.
create policy "Admins podem iniciar conversas com alunos elegiveis"
  on public.conversas for insert
  with check (
    public.is_admin()
    and exists (
      select 1
      from public.matriculas m
      join public.turmas t on t.id = m.turma_id
      join public.cursos c on c.id = t.curso_id
      where m.aluno_id = conversas.aluno_id
        and m.status = 'ativa'
        and c.tipo <> 'ead'
    )
  );

-- Sem policy/grant de update: o único campo mutável (ultima_mensagem_em)
-- é escrito por uma trigger security definer (ver abaixo), não por
-- update direto do client.
grant select on public.conversas to authenticated;
grant insert (aluno_id) on public.conversas to authenticated;
grant select, insert, update, delete on public.conversas to service_role;

-- ===== mensagens_chat =====

create table public.mensagens_chat (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  remetente_id uuid not null references public.profiles (id) on delete cascade,
  texto text not null,
  -- null = não lida; setada quando o OUTRO lado abre a conversa (ver
  -- marcar_mensagens_lidas). Cobre os dois sentidos com uma coluna só.
  lido_em timestamptz,
  created_at timestamptz not null default now()
);

create index mensagens_chat_conversa_id_idx on public.mensagens_chat (conversa_id);
create index mensagens_chat_nao_lidas_idx on public.mensagens_chat (conversa_id) where lido_em is null;

alter table public.mensagens_chat enable row level security;

create policy "Admins podem ver mensagens de chat"
  on public.mensagens_chat for select using (public.is_admin());

create policy "Alunos podem ver mensagens da propria conversa"
  on public.mensagens_chat for select
  using (
    exists (
      select 1 from public.conversas c
      where c.id = mensagens_chat.conversa_id and c.aluno_id = auth.uid()
    )
  );

create policy "Admins podem enviar mensagens em qualquer conversa"
  on public.mensagens_chat for insert
  with check (public.is_admin() and remetente_id = auth.uid());

create policy "Alunos podem enviar mensagens na propria conversa"
  on public.mensagens_chat for insert
  with check (
    remetente_id = auth.uid()
    and exists (
      select 1 from public.conversas c
      where c.id = mensagens_chat.conversa_id and c.aluno_id = auth.uid()
    )
  );

-- Sem grant de update pra authenticated: lido_em só muda via
-- marcar_mensagens_lidas (security definer, abaixo).
grant select on public.mensagens_chat to authenticated;
grant insert (conversa_id, remetente_id, texto) on public.mensagens_chat to authenticated;
grant select, insert, update, delete on public.mensagens_chat to service_role;

-- ===== ultima_mensagem_em atualizado automaticamente =====

create or replace function public.trg_atualizar_ultima_mensagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversas set ultima_mensagem_em = new.created_at where id = new.conversa_id;
  return new;
end;
$$;

create trigger atualizar_ultima_mensagem_on_insert
  after insert on public.mensagens_chat
  for each row execute function public.trg_atualizar_ultima_mensagem();

-- ===== marcar como lida (chamada por admin OU aluno, cada um só marca =====
-- ===== mensagens do OUTRO lado como lidas) =====

create or replace function public.marcar_mensagens_lidas(p_conversa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or exists (select 1 from public.conversas c where c.id = p_conversa_id and c.aluno_id = auth.uid())
  ) then
    return;
  end if;

  update public.mensagens_chat
  set lido_em = now()
  where conversa_id = p_conversa_id
    and lido_em is null
    and remetente_id <> auth.uid();
end;
$$;

grant execute on function public.marcar_mensagens_lidas(uuid) to authenticated;

-- ===== Realtime =====
-- RLS já protege quem recebe o quê via postgres_changes — não é um
-- filtro só client-side.

alter publication supabase_realtime add table public.mensagens_chat;
alter publication supabase_realtime add table public.conversas;
