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

## Commits

- Seguir [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.).

## Antes de considerar uma tarefa concluída

- Rodar `npm run lint`, `npm run typecheck` e `npm run build` sem erros.
- Nunca commitar arquivos `.env*` (exceto `.env.example`).

## Contexto do projeto

_(a preencher nas próximas fases conforme o domínio de negócio for definido)_
