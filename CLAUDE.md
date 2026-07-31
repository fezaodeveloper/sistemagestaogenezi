@AGENTS.md

# sistemagestaogenezi

## Stack

- Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (preset `nova`: Radix/Base UI + Lucide + Geist).
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

## Commits

- Seguir [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.).

## Antes de considerar uma tarefa concluída

- Rodar `npm run lint`, `npm run typecheck` e `npm run build` sem erros.
- Nunca commitar arquivos `.env*` (exceto `.env.example`).

## Contexto do projeto

_(a preencher nas próximas fases conforme o domínio de negócio for definido)_
