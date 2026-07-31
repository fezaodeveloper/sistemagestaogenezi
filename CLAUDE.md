@AGENTS.md

# sistemagestaogenezi

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (preset `nova`: Base UI + Lucide + Geist). Base UI usa a prop `render` para composição (equivalente ao `asChild` do Radix) — ex.: `<SidebarMenuButton render={<Link href="/admin">...</Link>} />`.
- Gerenciador de pacotes: npm.

## Convenções

- Componentes reutilizáveis em `src/components`; componentes gerados pelo shadcn ficam em `src/components/ui` e não devem ser editados manualmente além do necessário para customização de tema — prefira compor por cima.
- Lógica de servidor (acesso a dados, integrações externas) em `src/lib` ou `src/server`.
- Sem `any` implícito. Tipar props, retornos de funções exportadas e respostas de API.
- Preferir React Server Components por padrão. Adicionar `"use client"` apenas quando houver necessidade real de interatividade (estado, efeitos, event handlers), e justificar a escolha no componente quando não for óbvio.
- Estilização via classes utilitárias do Tailwind; evitar CSS solto fora de `globals.css`.

## Banco de dados (Supabase)

- Toda tabela nova tem RLS habilitado (`enable row level security`) e políticas explícitas por operação (select/insert/update/delete).
- Além das policies, cada tabela recebe `grant`s explícitos por coluna/operação para o role `authenticated` — não depender dos grants default do Postgres. Operações que não devem ser permitidas via API (ex.: criação de linha feita só por trigger `security definer`) não recebem grant correspondente.
- `service_role` bypassa RLS, mas **não** bypassa grants de tabela — toda tabela usada pelo client admin (`src/lib/supabase/admin.ts`) também precisa de `grant` explícito para `service_role` (geralmente amplo, sem restrição de coluna, já que essa role é o bypass administrativo).

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
