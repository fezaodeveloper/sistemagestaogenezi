-- Construtor de páginas de campanha (roadmap, item 1) — landing pages
-- públicas configuráveis pelo admin, com formulário multi-etapas e captura
-- automática de lead. Referência visual: bolsagenezi.netlify.app.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.campanha_paginas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  subtitulo text,
  descricao text,
  -- DESVIO DO SQL ORIGINAL — curso_id não estava no schema pedido, mas
  -- "criar lead automaticamente" (REGRAS) exige um curso: leads.curso_id é
  -- NOT NULL com FK pra cursos (ver 20260902100000_create_leads.sql), então
  -- sem essa coluna não haveria como satisfazer a constraint ao inserir o
  -- lead. Nullable de propósito: campanhas sem curso vinculado ainda salvam
  -- a resposta em campanha_respostas, só não geram lead (ver actions.ts).
  curso_id uuid references public.cursos (id) on delete set null,
  -- Visual
  cor_primaria text not null default '#06b6d4',
  cor_fundo text not null default '#0f172a',
  logo_url text,
  imagem_topo_url text,
  tema text not null default 'escuro'
    check (tema in ('escuro','claro')),
  -- Configurações
  status text not null default 'ativa'
    check (status in ('ativa','inativa','encerrada')),
  data_inicio timestamptz,
  data_fim timestamptz,
  vagas_limite integer,
  -- Contador regressivo
  mostrar_contador boolean not null default false,
  contador_data_fim timestamptz,
  -- Campos de dados básicos (sempre coletados)
  coletar_email boolean not null default false,
  coletar_cidade boolean not null default true,
  -- Etapas e questões (JSON)
  etapas jsonb not null default '[]'::jsonb,
  -- Ex: [{
  --   "titulo": "Vamos começar!",
  --   "descricao": "Preencha seus dados",
  --   "questoes": [{
  --     "id": "q1",
  --     "tipo": "multipla_escolha|texto|checkbox|select",
  --     "pergunta": "Qual é seu nível?",
  --     "obrigatoria": true,
  --     "opcoes": [{"letra": "A", "texto": "Iniciante"}]
  --   }]
  -- }]
  -- Termos e LGPD
  mostrar_lgpd boolean not null default true,
  texto_lgpd text,
  mostrar_declaracao boolean not null default false,
  texto_declaracao text,
  -- Mensagem de sucesso
  titulo_sucesso text not null default 'Inscrição enviada!',
  mensagem_sucesso text,
  -- Notificações
  notificar_telegram boolean not null default true,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campanha_respostas (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references public.campanha_paginas (id) on delete cascade,
  -- Dados básicos sempre coletados
  nome text not null,
  whatsapp text not null,
  -- DESVIO DO SQL ORIGINAL — "Idade (obrigatório)" está na descrição da
  -- etapa de dados básicos (BLOCO 3) mas não tinha coluna própria. Criada
  -- como coluna real (não uma chave dentro de `respostas`) porque é um
  -- dado sempre coletado, igual nome/whatsapp/email/cidade, e a tela de
  -- respostas/export em Excel (BLOCO 4) precisa dela como coluna filtrável.
  idade integer,
  email text,
  cidade text,
  -- Respostas das questões (JSON)
  respostas jsonb not null default '{}'::jsonb,
  -- Ex: {"q1": "A", "q2": "texto livre", "q3": true}
  -- Consentimentos (LGPD / declaração de interesse) também não tinham
  -- coluna própria — guardados aqui com chaves reservadas
  -- "_aceite_lgpd"/"_aceite_declaracao" (prefixo "_" pra nunca colidir com
  -- o id de uma questão real, que vem do editor como "q1", "q2" etc.),
  -- preservando o registro de consentimento sem precisar de mais colunas.
  -- Metadados
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index campanha_respostas_pagina_idx on public.campanha_respostas (pagina_id);

alter table public.campanha_paginas enable row level security;
alter table public.campanha_respostas enable row level security;

create policy "Admins gerenciam páginas de campanha"
  on public.campanha_paginas for all using (public.is_admin());
create policy "Público pode ver páginas ativas"
  on public.campanha_paginas for select
  using (status = 'ativa');

create policy "Admins gerenciam respostas"
  on public.campanha_respostas for all using (public.is_admin());
create policy "Público pode enviar respostas"
  on public.campanha_respostas for insert with check (true);

create trigger on_campanha_paginas_updated
  before update on public.campanha_paginas
  for each row execute function public.handle_updated_at();

grant select on public.campanha_paginas to anon, authenticated;
grant insert on public.campanha_respostas to anon;
grant select, insert on public.campanha_respostas to authenticated;
grant select, insert, update, delete on public.campanha_paginas to service_role;
grant select, insert, update, delete on public.campanha_respostas to service_role;

-- DESVIO DO SQL ORIGINAL — 'campanha' não é um valor válido do enum
-- public.lead_origem (só indicacao/redes_sociais/google/panfleto/outro, ver
-- 20260902100000_create_leads.sql). REGRAS pede "origem='campanha'" ao criar
-- o lead automaticamente — sem isso o INSERT falharia.
alter type public.lead_origem add value if not exists 'campanha';

-- ===== Storage: logo e imagem de topo da página de campanha =====
-- Mesmo padrão dos buckets "login-banners"/"campanhas-marketing" já
-- existentes: bucket público (só ilustra a landing page, sem dado
-- sensível), upload restrito a admin via policies em storage.objects.

insert into storage.buckets (id, name, public) values ('campanha-paginas', 'campanha-paginas', true);

create policy "Admins enviam imagens de páginas de campanha"
  on storage.objects for insert
  with check (bucket_id = 'campanha-paginas' and public.is_admin());
create policy "Admins atualizam imagens de páginas de campanha"
  on storage.objects for update
  using (bucket_id = 'campanha-paginas' and public.is_admin());
create policy "Admins excluem imagens de páginas de campanha"
  on storage.objects for delete
  using (bucket_id = 'campanha-paginas' and public.is_admin());
