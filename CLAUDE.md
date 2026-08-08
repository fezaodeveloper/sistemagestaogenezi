@AGENTS.md

# sistemagestaogenezi

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (preset `nova`: Base UI + Lucide + Geist). Base UI usa a prop `render` para composição (equivalente ao `asChild` do Radix) — ex.: `<SidebarMenuButton render={<Link href="/admin">...</Link>} />`.
- `Button` do Base UI espera um `<button>` nativo por padrão (`nativeButton` default `true`). Ao compor com `render={<Link .../>}` (uma `<a>`), sempre passar `nativeButton={false}` — sem isso, funciona visualmente mas loga erro de runtime sobre semântica de acessibilidade.
- Mesmo com `render={<Link .../>}`, o `Button` do Base UI define `role="button"` no `<a>` renderizado (não `role="link"`), já que semanticamente ainda é um Button. Em testes com Playwright/Testing Library, localizadores por role para esses links de ação (ex. "Editar" nas tabelas de listagem) devem usar `getByRole("button", { name: ... })`, não `getByRole("link", ...)`.
- `Select` do Base UI (`src/components/ui/select.tsx`) só resolve o label exibido a partir de um `defaultValue`/`value` se a prop `items` (`Record<string, ReactNode>`) for passada em `<Select>`. Sem isso, ao carregar a página já com um valor selecionado (ex.: formulário de edição), o trigger mostra o valor cru (ex.: um UUID) em vez do label — só corrige depois que o usuário abre o dropdown manualmente. Sempre passar `items` quando o `Select` puder nascer com `defaultValue` preenchido.
- Gerenciador de pacotes: npm.

## Ambiente de desenvolvimento (dev server)

- **Cache stale do Turbopack após mudança estrutural de rotas:** já aconteceu mais de uma vez o `npm run dev` continuar rodando com uma versão stale do cache depois que arquivos de rota são criados/movidos (ex.: uma pasta nova em `src/app/.../[param]/page.tsx`) com o servidor já de pé. **Sintoma:** 404 ("This page could not be found") numa rota que existe de verdade no disco e está correta — muitas vezes logo depois de criar os arquivos com o dev server já rodando desde antes. Isso confunde com um bug de lógica (ex.: um `notFound()` sendo chamado por engano na página), mas não é — os arquivos e o código estão certos, só o processo do dev server é que está com uma visão desatualizada da árvore de rotas.
  - **Diagnóstico rápido:** testar a mesma URL sem autenticação. Se vier um redirect (302/307) em vez de 404 puro, o Next _está_ reconhecendo a rota e executando o código — descarta bug de lógica, indica cache stale.
  - **Solução:** encerrar o processo Node do dev server e rodar `npm run dev` de novo (não precisa recompilar o projeto inteiro nem apagar `node_modules`). Se persistir, apagar a pasta `.next` antes de subir de novo.

## Convenções

- Componentes reutilizáveis em `src/components`; componentes gerados pelo shadcn ficam em `src/components/ui` e não devem ser editados manualmente além do necessário para customização de tema — prefira compor por cima.
- Lógica de servidor (acesso a dados, integrações externas) em `src/lib` ou `src/server`.
- Sem `any` implícito. Tipar props, retornos de funções exportadas e respostas de API.
- Preferir React Server Components por padrão. Adicionar `"use client"` apenas quando houver necessidade real de interatividade (estado, efeitos, event handlers), e justificar a escolha no componente quando não for óbvio.
- Estilização via classes utilitárias do Tailwind; evitar CSS solto fora de `globals.css`.

## Banco de dados (Supabase)

- Toda tabela nova tem RLS habilitado (`enable row level security`) e políticas explícitas por operação (select/insert/update/delete).
- Além das policies, cada tabela recebe `grant`s explícitos por coluna/operação para o role `authenticated` — não depender dos grants default do Postgres. Operações que não devem ser permitidas via API (ex.: criação de linha feita só por trigger `security definer`) não recebem grant correspondente.
- Toda tabela tem `created_by uuid not null references public.profiles (id) default auth.uid()`. Quando `created_by` só pode ser preenchido por um **admin** (a esmagadora maioria dos casos até hoje), o FK padrão (sem `on delete cascade`) é seguro, porque na prática uma conta admin nunca é excluída pelo app. Mas se uma tabela nova permite que um papel **não-admin** insira nela (ex.: aluno respondendo quiz, marcando aula como concluída, editando o próprio perfil), `created_by` vai apontar pra conta desse aluno — e contas de aluno **são** excluídas rotineiramente (`deleteAluno` em `/admin/alunos`). Sem `on delete cascade` nesse caso, excluir o aluno falha (violação de FK), porque o Postgres tenta apagar o `profiles` dele em cascata e esbarra no `created_by` apontando de volta. Bug real já encontrado em `aulas_concluidas` (corrigido em `20260814110000`). **Toda tabela nova cujo `created_by` possa ser preenchido por um papel não-admin precisa de `on delete cascade` na FK de `created_by` desde a criação.**
- `service_role` bypassa RLS, mas **não** bypassa grants de tabela — toda tabela usada pelo client admin (`src/lib/supabase/admin.ts`) também precisa de `grant` explícito para `service_role` (geralmente amplo, sem restrição de coluna, já que essa role é o bypass administrativo).
- **Pendência conhecida, não urgente:** `turmas`, `cursos` e `matriculas` não têm `grant` para `service_role` (só para `authenticated`) — descoberto ao usar o client admin (`service_role`) pra inspecionar dados dessas tabelas num script de seed/teste, que falhou com "permission denied for table X". Não afeta o app hoje porque nenhuma tela usa `src/lib/supabase/admin.ts` pra ler/escrever essas tabelas (o CRUD delas roda inteiramente via client autenticado normal, respeitando RLS). Corrigir com `grant select, insert, update, delete on public.<tabela> to service_role;` se e quando alguma rotina passar a precisar do bypass nessas tabelas.

## Storage (Supabase)

- Buckets que guardam arquivo de conteúdo protegido (ex.: `materiais`, PDFs de curso) são privados (`public: false`) com policies em `storage.objects` filtrando por `bucket_id` + `is_admin()`, mesmo padrão de RLS das tabelas. Nunca expor URL pública permanente para esse tipo de arquivo — a visualização gera signed URL de curta duração sob demanda.
- **Limitação conhecida, não urgente:** exclusão em cascata via FK (ex.: apagar um curso ou aula que tem `materiais` do tipo `pdf` vinculados) remove as linhas da tabela, mas não aciona nenhum código de aplicação — o arquivo correspondente no bucket do Storage fica órfão, já que o cascade do Postgres não tem visibilidade sobre `storage.objects`. Só a exclusão de um material individual (`deleteMaterial`) limpa o arquivo, porque é código de aplicação, não FK cascade. Resolver mais adiante com uma rotina de limpeza (comparar bucket vs. linhas existentes) ou um trigger/Edge Function, se o volume de exclusão em cascata justificar.
- Upload de arquivo via Server Action exige aumentar `experimental.serverActions.bodySizeLimit` no `next.config.ts` (default do Next é 1MB, pequeno demais para PDF) — configurado para `10mb`.

## Autenticação e autorização

- Diferenciação de papéis via coluna `role` em `profiles` (`admin` | `aluno`, default `aluno`). Sem tabelas separadas por papel.
- `src/proxy.ts` faz o refresh de sessão (`getClaims()`) e o roteamento otimista por role — é conveniência de UX, **não** a fronteira de segurança.
- A checagem de verdade é `requireRole()` (`src/lib/auth/dal.ts`), chamada tanto no `layout.tsx` de cada área quanto em cada `page.tsx` individualmente. Motivo: por causa do Partial Rendering do Next.js, layouts não re-renderizam (logo não re-checam auth) em toda navegação client-side entre rotas irmãs — a checagem precisa estar perto de cada página, não só no layout pai. `requireRole()` usa `cache()` do React, então chamar duas vezes na mesma request não duplica a query.
- Áreas novas dentro de `/admin` ou `/aluno` devem sempre chamar `requireRole()` no topo da própria `page.tsx`, mesmo já protegidas pelo layout.
- **Server Action + `redirect()` encadeado (bug/limitação do Next 16):** se uma Server Action chama `redirect("/x")` e a página `/x` por sua vez chama `redirect("/y")` durante o mesmo ciclo de "single response" (form enviado via JS, não um POST puro), o router do client fica preso em `/x` sem aplicar o segundo redirect — confirmado empiricamente em `signInWithPassword`. Solução: a Server Action deve calcular e redirecionar direto para o destino final (um único `redirect()`), nunca depender de uma página intermediária redirecionar de novo. Redirects reais de Route Handler (`NextResponse.redirect`, como em `auth/callback`) não têm esse problema — cada hop é uma request HTTP de verdade.

## Formulários e Server Actions

- Toda Server Action que recebe input de formulário valida com **Zod** antes de tocar no Supabase — nunca confiar em `FormData` bruto. Erros de validação retornam por campo (`useActionState`), não como exceção.
- Toda Server Action chama `requireRole(...)` no próprio corpo, mesmo que a página que a invoca já esteja protegida por layout/page — a action é um endpoint alcançável por POST direto, precisa se autoproteger.
- CRUDs de gestão usam página dedicada para criar/editar (`/recurso/novo`, `/recurso/[id]/editar`), não modal — funciona sem JS, URL compartilhável, mais simples com Server Actions.

## Estados de UI: loading, vazio e erro

Toda tela que busca dados trata os três estados explicitamente:

- **Loading**: `loading.tsx` do próprio Next (Suspense automático) com skeleton, não spinner client-side, para telas que buscam dados em Server Component.
- **Vazio**: mensagem + call-to-action específico da tela (ex.: "nenhum curso cadastrado" + botão "novo curso"), nunca só uma tabela em branco.
- **Erro**: erro de query tratado inline na própria página (sem deixar estourar exceção); `error.tsx` no segmento como rede de segurança para exceções inesperadas; erro de submit de formulário exibido no próprio form via `useActionState`.

## Commits

- Seguir [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.).

## Antes de considerar uma tarefa concluída

- Rodar `npm run lint`, `npm run typecheck` e `npm run build` sem erros.
- Nunca commitar arquivos `.env*` (exceto `.env.example`).

## Contexto do projeto

_(a preencher nas próximas fases conforme o domínio de negócio for definido)_

### Fase 14 (Portal do aluno) — especificações confirmadas

Ainda não implementado; documentado aqui com antecedência para orientar o desenho das fases anteriores (ex.: schema de `materiais`).

- Vídeos do YouTube devem ser embutidos via player embed dentro da própria plataforma — o aluno nunca deve ser levado ao YouTube externo. Usar parâmetros do embed (`modestbranding`, sem vídeos relacionados, etc.) para minimizar a marca do YouTube o quanto o embed permitir, sem tentar remover 100% — isso violaria os termos do YouTube.
- PDFs e slides devem ter visualizador interno na plataforma — sem download direto, sem abrir em nova aba ou app externo.
- O player/visualizador de aula deve ter um botão "próxima aula" para o aluno navegar sequencialmente sem sair da tela.
