# 📘 Documentação Técnica — Sistema de Gestão Gênezi

> Gerado em: 06/11/2026

Documentação técnica gerada a partir da leitura real do código-fonte, migrations e configuração do repositório `sistemagestaogenezi`. Não substitui o `CLAUDE.md` (convenções de trabalho) nem o `AGENTS.md` (avisos sobre a versão do Next.js) — leia os dois antes de alterar o projeto.

---

## 📦 1. Stack e dependências

**Framework base:** Next.js `16.2.12` (App Router) · React `19.2.4` · TypeScript `^5` (modo `strict`) · Tailwind CSS `^4` (via `@theme inline` em `src/app/globals.css`, sem `tailwind.config.ts` — convenção do Tailwind v4) · shadcn/ui preset `nova` (Base UI + Lucide + Geist).

### Dependências de produção

| Pacote | Versão | Uso no projeto |
|---|---|---|
| `next` | 16.2.12 | Framework (App Router) |
| `react` / `react-dom` | 19.2.4 | UI |
| `@base-ui/react` | ^1.6.0 | Primitivos headless por trás do shadcn (`render` prop no lugar de `asChild`) |
| `@supabase/ssr` | ^0.12.4 | Client Supabase com cookies (server/proxy) |
| `@supabase/supabase-js` | ^2.111.0 | Client Supabase (browser e admin) |
| `@react-pdf/renderer` | ^4.6.1 | Geração de PDFs (comprovantes, contratos, certificados, resultado de campanha) |
| `pdf-lib` | ^1.17.1 | Manipulação de PDF (termos/contratos assinados) |
| `@tiptap/*` | ^3.30.0 | Editor de texto rico (termos legais, templates de email) |
| `stripe` | ^22.6.2 | Gateway de pagamento (um dos adapters em `src/lib/gateways/adapters/`) |
| `nodemailer` | ^10.0.10 | Envio de email (uso pontual) |
| `web-push` | ^3.6.7 | Push notifications para alunos |
| `xlsx` | ^0.18.5 | Exportação de relatórios/respostas em Excel |
| `recharts` | ^3.10.1 | Gráficos (dashboards admin) |
| `class-variance-authority`, `clsx`, `tailwind-merge` | — | Variantes de componentes shadcn |
| `lucide-react` | ^1.27.0 | Ícones |
| `zod` | ^4.4.3 | Validação de formulários/Server Actions |
| `server-only` | ^0.0.1 | Garante que módulos server-side nunca sejam importados no client |
| `shadcn` | ^4.16.0 | CLI de geração de componentes |

### Dependências de desenvolvimento

`typescript`, `eslint` + `eslint-config-next` + `eslint-config-prettier`, `prettier` + `prettier-plugin-tailwindcss`, `tailwindcss` + `@tailwindcss/postcss`, `@types/*`.

### Scripts (`package.json`)

```
npm run dev         # next dev
npm run build       # next build
npm run start       # next start
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run format      # prettier --write .
npm run format:check
```

### `next.config.ts`

- `experimental.serverActions.bodySizeLimit = "10mb"` — aumentado do default de 1MB para permitir upload de PDFs de materiais de curso via Server Action.
- Comentário no próprio arquivo documenta um incidente de deploy na Vercel causado por cache stale de build referenciando um hash antigo do módulo CSS da fonte Figtree — resolvido mudando a config da fonte (`display: "swap"`), sem alteração necessária neste arquivo.

### `tsconfig.json`

- `strict: true`, `target: ES2017`, `moduleResolution: bundler`, `jsx: react-jsx`.
- Path alias: `"@/*": ["./src/*"]`.

### Tailwind v4

Não há `tailwind.config.ts`/`.js` — todo o tema (cores, sidebar, charts, fontes) é declarado via `@theme inline { ... }` dentro de `src/app/globals.css`, com variáveis `--color-*` e `--font-*` mapeadas para custom properties CSS (`--background`, `--primary`, `--sidebar`, `--chart-1..5` etc.), seguindo o padrão shadcn/Tailwind v4.

---

## 📁 2. Estrutura de pastas

### `src/app/` — rotas (App Router)

**Área admin** (`src/app/admin/`, protegida por `requireRole("admin")`) — 36 módulos: `academico`, `acesso-remoto`, `alunos`, `api` (gestão de chaves da API pública), `automacoes`, `calendario`, `certificados`, `chat`, `comercial` (inclui `paginas-campanha`), `conecta`, `configuracoes`, `contrato`, `contratos`, `cronograma`, `cursos`, `cursos-gratuitos`, `email-marketing`, `engajamento`, `estoque`, `financeiro`, `fornecedores`, `leads`, `legal`, `manutencao`, `matriculas`, `mensagens`, `notificacoes`, `pendencias`, `premios`, `professor`, `relatorios`, `resgates`, `termos`, `treinamentos`, `turmas`, `whatsapp-fluxos`, `whatsapp-mensagens`.

**Área aluno** (`src/app/aluno/`, protegida por `requireRole("aluno")`) — 15 módulos: `certificados`, `comentarios`, `comunidade`, `conecta`, `conquistas`, `contrato`, `creditos`, `cursos`, `financeiro`, `gamificacao`, `legal`, `mensagens`, `notificacoes`, `perfil`, `ranking`.

**Área empresa** (`src/app/empresa/`, portal do Gênezi Conecta, protegida por `requireRole("empresa")` dentro do grupo `(protegido)/`) — `candidatos`, `notificacoes`, `painel`, `perfil`, `vagas`; fora do grupo protegido: `login`, `cadastro`, `aguardando-pagamento`.

**Rotas públicas** (ver seção 7) — `agendar/[slug]`, `campanha/[slug]`, `captacao`, `conecta/*`, `contrato/[matriculaId]/assinar`, `descadastro/[token]`, `entrar`, `login`, `nova-senha`, `recuperar-senha`, `responsavel`, `termo-imagem/[matriculaId]/assinar`, `page.tsx` (landing raiz).

**`src/app/api/`** — Route Handlers, ver seção 6.

**`src/proxy.ts`** — proxy de autenticação/roteamento (ver seção "Autenticação" abaixo).

### `src/lib/` — lógica de servidor, 208 arquivos em ~75 subpastas

Organização por domínio, cada pasta tipicamente com `schema.ts` (Zod + tipos) e o arquivo de acesso a dados principal. Destaques:

- `auth/` — `dal.ts` (`requireRole`, `requireEmpresa`, `getCurrentProfile`), `roles.ts`.
- `supabase/` — `client.ts` (browser), `server.ts` (RSC/Server Action, respeita RLS), `admin.ts` (`service_role`, bypassa RLS), `proxy.ts` (client para o proxy).
- `whatsapp/` — sistema moderno "GênZap" (Evolution API): `eventos.ts`, `templates.ts`, `enviar.ts`, `evolution.ts`, `fluxos.ts`, `variaveis.ts`, `verificar-toggle.ts`, `config.ts`.
- `mensagens/` — sistema legado de WhatsApp (4 tipos fixos via enum Postgres): `mensagens.ts`, `evolution.ts`, `texto.ts`, `schema.ts`.
- `email/` — `eventos.ts`, `marketing.ts`, `provedor.ts`, `config.ts` (Resend).
- `telegram/` — `client.ts`, `verificar-toggle.ts`.
- `push/` — `enviar.ts` (Web Push para alunos).
- `gateways/` — abstração multi-gateway de pagamento: `manager.ts`, `catalogo.ts`, `types.ts`, `config.ts`, `adapters/{asaas,stripe,mercadopago,pagarme,efi}.ts`.
- `asaas/` — client dedicado do Asaas (gateway principal/legado, usado também no financeiro e no Gênezi Conecta).
- `campanha-paginas/` — páginas de campanha (leads), schema com etapas/questões/pontuação.
- `campanhas/` — campanhas de marketing (email/WhatsApp em massa).
- `agendamentos/` — agendamentos públicos de visita/matrícula.
- `conecta/` — Gênezi Conecta (bolsa de empregos para alunos/empresas): `acesso.ts`, `schema.ts`, `telegram.ts`, `whatsapp.ts`.
- `certificados/`, `gamificacao/`, `badges`/`avatares` (dentro de `avatares/`), `creditos/`, `premios/` — módulo de gamificação e recompensas.
- `financeiro/` — `inadimplencia.ts`, `limpeza.ts`, `schema.ts`.
- `pdf/` — helpers compartilhados de geração de PDF (`logo-escola.ts`).
- `ibge/` — `municipios.ts` (API de cidades/estados).
- `storage/` — upload/validação de arquivos no Supabase Storage.
- `historico/` — log de alterações (auditoria).
- `relatorios/` — exportações (ex.: `frequencia-turma-excel.ts`).
- `webhooks/` — utilitários para os webhooks de entrada.
- `spedy/`, `mei/`, `integrax/` — integrações comerciais/fiscais adicionais.

### `src/components/` — 357 componentes `.tsx`

- `ui/` — componentes gerados pelo shadcn (preset `nova`), não editar manualmente além de customização de tema.
- `admin/` — componentes de tela do admin (maior parte do volume).
- `aluno/`, `empresa/`, `conecta/`, `agendamentos/`, `campanha/`, `chat/`, `contrato/`, `gamificacao/`, `leads/`, `pdf/` (componentes `@react-pdf/renderer`), `pixels/`, `responsavel/`, `termo-imagem/`, `auth/`.

### `supabase/migrations/` — 182 arquivos

Nomeadas `YYYYMMDDHHmmss_descricao.sql`, de `20260731120000_create_profiles.sql` (primeira) até `20261104200000_campanha_confirmacao_whatsapp.sql` (mais recente). Cobrem desde o schema inicial (`profiles`, `cursos`, `turmas`, `alunos`, `matriculas`, `aulas`) até módulos recentes (campanhas de marketing, Gênezi Conecta, gateways de pagamento multi-provedor, fluxos de WhatsApp, portal do responsável). **Todas as migrations deste repositório são escritas com `-- NÃO APLICADA` no topo e aplicadas manualmente pelo Fernando no SQL Editor do Supabase** — nenhuma é rodada via `supabase db push`.

---

## 🗄️ 3. Banco de dados (Supabase)

### Padrão de clients (`src/lib/supabase/`)

| Client | Arquivo | RLS | Uso |
|---|---|---|---|
| `createClient()` | `server.ts` | Respeita RLS | Server Components e Server Actions — maioria absoluta dos acessos a dados |
| `createClient()` (browser) | `client.ts` | Respeita RLS | Componentes client (`"use client"`) que precisam de acesso direto |
| `createAdminClient()` | `admin.ts` | **Bypassa RLS** (`service_role`) | Rotas públicas sem sessão (ex.: `/api/campanha-respostas/[id]/pdf`), webhooks, crons, proxy (checagem de `conecta_habilitado`) |
| `createProxyClient()` | `proxy.ts` | Respeita RLS | Usado só dentro de `src/proxy.ts`, vinculado aos cookies da request/response |

`service_role` bypassa RLS mas **não** bypassa GRANTs de tabela — toda tabela acessada via `createAdminClient()` precisa de GRANT explícito para `service_role` (pendência conhecida documentada no `CLAUDE.md`: `turmas`, `cursos` e `matriculas` ainda não têm esse grant, mas nenhuma tela usa o client admin nelas hoje).

### Padrão de RLS e grants

- Toda tabela tem RLS habilitado e políticas explícitas por operação.
- Grants explícitos por coluna/operação para `authenticated` (não se depende dos grants default do Postgres).
- `created_by uuid not null references public.profiles (id) default auth.uid()` em toda tabela; `on delete cascade` nessa FK quando o papel que insere pode ser não-admin (ex.: aluno) — e `on delete` padrão (sem cascade) quando só admin insere.

### Enums relevantes

- `mensagem_whatsapp_tipo` (sistema legado, `src/lib/mensagens/`): `'matricula_criada' | 'lembrete_aula' | 'falta'`.
- `mensagem_whatsapp_status`: `'pendente' | 'enviado' | 'falha'`.
- `whatsapp_templates.id` tem uma CHECK constraint enumerando os IDs válidos de template do sistema moderno (GênZap) — toda vez que um template novo é adicionado ao catálogo em `src/lib/whatsapp/templates.ts`, a constraint precisa ser atualizada via migration também, senão a edição do template na tela admin falha silenciosamente.

### Tabelas/módulos por ordem cronológica de criação (resumo)

`profiles` → `cursos`/`turmas`/`alunos`/`matriculas` → `aulas`/`materiais`/`presencas` → `modulos`/`quizzes`/`provas` → `aulas_concluidas` → `quiz_tentativas`/`prova_tentativas` → `calendario_aulas_turma` → `liberacoes_manuais` → gamificação (`pontos_gamificacao`, `badges`, `avatares`, `streak`, `creditos`, `premios`, `resgates`) → `certificados` → `mensagens_whatsapp` (legado) → `categorias_financeiro` → `leads` → `chat_interno` → `fornecedores` → gamificação avançada → módulo financeiro completo → `configuracoes` (singleton da escola) → `treinamentos` → motor de automações → API pública (`api_publica`) → `login_banners` → Gênezi Conecta (empresas, candidaturas, cidades) → `campanhas_marketing`/`campanha_paginas`/`campanha_respostas` → `agendamentos` → `gateways_config` (multi-gateway) → `webhooks_saida` → `email_marketing`/`email_templates`/`email_descadastros` → `comunidade` → `whatsapp_genzap`/`whatsapp_templates`/`whatsapp_fluxos` (sistema moderno) → `telegram_notif_toggles`/`whatsapp_notif_toggles` → `cursos_gratuitos` → portal do responsável (`responsavel_portal_token`, `responsavel_senha`) → CRM upgrade de `leads` → integrações comerciais → upgrade de agendamentos (horários/janela/campanha/visual/confirmação WhatsApp) → scoring e visual de campanhas (mais recente, commit `4913426`).

---

## 🔐 4. Variáveis de ambiente

Documentadas em `.env.example` na raiz (sem valores reais — confirmado existir). Nenhum `.env.local` foi lido (contém segredos reais e não deve ser versionado).

| Variável | Serviço |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase — URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase — chave pública (browser) |
| `SUPABASE_SECRET_KEY` | Supabase — chave `service_role`, uso exclusivo server-side |
| `NEXT_PUBLIC_SITE_URL` | URL base de produção (links de email, cobrança, Conecta) |
| `CRON_SECRET` | Autenticação dos crons da Vercel (`Authorization: Bearer`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot Telegram (`@genezi_educacao_bot`) — notificações internas |
| `ASAAS_API_KEY`, `ASAAS_API_URL` | Gateway de pagamento Asaas (financeiro + Gênezi Conecta) |
| `GATEWAYS_ENCRYPTION_KEY` | Criptografia das credenciais de gateways salvas em `gateways_config` |
| `ASAAS_WEBHOOK_TOKEN` | Autenticação dos webhooks do Asaas |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Resend — emails transacionais |
| `EVOLUTION_WEBHOOK_SECRET` | Autenticação do webhook de entrada da Evolution API (WhatsApp) |
| `TELEGRAM_WEBHOOK_SECRET` | Autenticação do webhook do Telegram |

---

## 🔌 5. Integrações externas

| Serviço | Onde é usado | Variável(is) |
|---|---|---|
| **Supabase** (Postgres + Auth + Storage) | Todo o projeto | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| **Evolution API** (WhatsApp) | `src/lib/whatsapp/evolution.ts` (sistema moderno), `src/lib/mensagens/evolution.ts` (legado), webhook em `src/app/api/webhooks/evolution/route.ts`, rotas `src/app/api/whatsapp/{conectar,status}/route.ts` | `EVOLUTION_WEBHOOK_SECRET` |
| **Telegram** | `src/lib/telegram/client.ts`, `src/lib/conecta/telegram.ts`, webhook em `src/app/api/webhooks/telegram/route.ts`, rota de teste `src/app/api/telegram/teste/route.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` |
| **Asaas** | `src/lib/asaas/client.ts`, adapter em `src/lib/gateways/adapters/asaas.ts`, webhooks `src/app/api/webhooks/{asaas,asaas-conecta}/route.ts` | `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN` |
| **Stripe** | `src/lib/gateways/adapters/stripe.ts`, webhook `src/app/api/webhooks/stripe/route.ts` | credenciais salvas (criptografadas) em `gateways_config`, não em env var fixa |
| **Mercado Pago** | `src/lib/gateways/adapters/mercadopago.ts`, webhook `src/app/api/webhooks/mercadopago/route.ts` | idem (via `gateways_config`) |
| **PagarMe** | `src/lib/gateways/adapters/pagarme.ts`, webhook `src/app/api/webhooks/pagarme/route.ts` | idem |
| **Efí (Gerencianet)** | `src/lib/gateways/adapters/efi.ts`, webhook `src/app/api/webhooks/efi/route.ts` | idem |
| **Resend** | `src/lib/resend/{client,emails,templates}.ts` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Web Push** | `src/lib/push/enviar.ts` | chaves VAPID (não documentadas em `.env.example` — verificar `src/lib/push/` se necessário) |
| **IBGE** (API pública de municípios/UF) | `src/lib/ibge/municipios.ts` | nenhuma (API pública, sem chave) |
| **Vercel Cron** | 13 rotas em `src/app/api/cron/*` | `CRON_SECRET` |

Todos os gateways de pagamento (Stripe, Mercado Pago, PagarMe, Efí, e também Asaas quando configurado por ali) são gerenciados de forma unificada por `src/lib/gateways/manager.ts`, que lê as credenciais da tabela `gateways_config` (criptografadas com `GATEWAYS_ENCRYPTION_KEY`) em vez de env vars fixas — permite trocar/cadastrar gateway pela tela `/admin/configuracoes/gateways` sem deploy.

---

## 🌐 6. Rotas da API (`src/app/api/`) — 36 rotas

### Webhooks de entrada (sempre com validação de assinatura/token, sem `requireRole`)

| Rota | Serviço | Observação |
|---|---|---|
| `webhooks/asaas` | Asaas | Valida header `asaas-access-token` |
| `webhooks/asaas-conecta` | Asaas (Gênezi Conecta) | Fluxo de pagamento separado do financeiro escolar |
| `webhooks/stripe` | Stripe | — |
| `webhooks/mercadopago` | Mercado Pago | — |
| `webhooks/pagarme` | PagarMe | — |
| `webhooks/efi` | Efí | — |
| `webhooks/evolution` | Evolution API (WhatsApp entrante) | Valida `EVOLUTION_WEBHOOK_SECRET` |
| `webhooks/telegram` | Telegram | Valida `TELEGRAM_WEBHOOK_SECRET` |

### WhatsApp (ações administrativas, protegidas)

| Rota | Método | Função |
|---|---|---|
| `whatsapp/conectar` | — | Inicia conexão da instância Evolution API (QR code) |
| `whatsapp/status` | GET | Status da conexão WhatsApp |

### PDFs (públicas de propósito — ID como bearer token implícito, sem `requireRole`)

| Rota | Conteúdo |
|---|---|
| `comprovantes/[matriculaId]/pdf` | Comprovante de matrícula |
| `comprovantes/parcela/[parcelaId]/pdf` | Recibo de parcela |
| `contratos/[matriculaId]/pdf` | Contrato de matrícula |
| `campanha-respostas/[respostaId]/pdf` | Resultado de inscrição em campanha (novo, PARTE 3) |

### API pública versionada (`v1/`) — integrações externas de terceiros autenticadas por API key

`v1/alunos`, `v1/eventos`, `v1/financeiro`, `v1/leads`, `v1/matriculas`, `v1/presencas`, `v1/webhooks` — gerenciadas pela tela `/admin/api` (módulo "API pública", migration `20260915100000_api_publica.sql`).

### Diagnóstico

`conecta/status` — status de disponibilidade do Gênezi Conecta.

### `telegram/teste`

Rota de teste manual de envio Telegram (uso administrativo).

### Crons (ver seção 8)

13 rotas em `api/cron/*`.

---

## 🌍 7. Rotas públicas (sem autenticação)

| Rota | Parâmetros | Descrição |
|---|---|---|
| `/` | — | Landing page |
| `/login` | — | Login do admin |
| `/entrar` | — | Login do aluno |
| `/recuperar-senha`, `/nova-senha` | — | Fluxo de recuperação de senha (admin/aluno) |
| `/captacao` | — | Página de captação/institucional |
| `/responsavel` | — | Portal do responsável (acesso via token, não login tradicional) |
| `/campanha/[slug]` | `slug` da `campanha_paginas` | Formulário público multi-etapa de campanha de marketing (leads) — ver PARTE 0–8 do módulo de campanhas |
| `/agendar/[slug]` | `slug` da campanha de agendamento | Formulário público de agendamento de visita/matrícula |
| `/agendar/[slug]/meu-agendamento/[agendamentoId]` | `slug`, `agendamentoId` | Consulta/gestão do próprio agendamento (ID como bearer implícito) |
| `/contrato/[matriculaId]/assinar` | `matriculaId` | Assinatura pública do contrato de matrícula |
| `/termo-imagem/[matriculaId]/assinar` | `matriculaId` | Assinatura pública do termo de uso de imagem |
| `/descadastro/[token]` | `token` | Descadastro de email marketing (opt-out) |
| `/empresa/login`, `/empresa/cadastro`, `/empresa/aguardando-pagamento` | — | Onboarding público de empresas no Gênezi Conecta (área `/empresa/(protegido)/*` exige `requireRole("empresa")`) |
| `/conecta/*` (`vagas`, `cadastro`, `criar-senha`, `aguardando-pagamento`, `empresa/[id]`, `lgpd`, `privacidade`, `cookies`, `termos-de-uso`) | `id` da empresa em `empresa/[id]` | Portal público do Gênezi Conecta (candidatos) |

Todas as rotas acima que recebem um ID/token na URL (ex.: `[matriculaId]`, `[respostaId]`, `[token]`, `[agendamentoId]`) seguem o padrão "UUID/token como bearer implícito": a própria rota já é o controle de acesso, sem sessão — convenção usada de forma consistente em todo o projeto para fluxos de participante anônimo.

---

## ⏰ 8. Crons (`vercel.json`)

13 crons, todos **diários ou semanais/mensais** (nenhum com intervalo menor que 24h — restrição do plano Vercel Hobby):

| Rota | Horário (UTC) | Frequência |
|---|---|---|
| `/api/cron/lembretes-aula` | 11:00 | Diário |
| `/api/cron/resumo-diario` | 10:30 | Diário |
| `/api/cron/relatorio-semanal` | 21:00 sexta-feira | Semanal |
| `/api/cron/verificar-atrasos` | 11:00 | Diário |
| `/api/cron/calcular-evasao` | 12:00 | Diário |
| `/api/cron/resumo-mensal` | 10:00, dia 1 | Mensal |
| `/api/cron/followup-leads` | 12:00 | Diário |
| `/api/cron/lembrete-agendamentos` | 21:00 | Diário |
| `/api/cron/aviso-presenca` | 22:00 | Diário |
| `/api/cron/email-campanhas` | 13:00 | Diário |
| `/api/cron/sms-recuperacao` | 14:00 | Diário |
| `/api/cron/whatsapp-fluxos` | 15:00 | Diário |
| `/api/cron/push-agendamentos` | 08:00 | Diário |

Todas as rotas de cron validam o header `Authorization: Bearer <CRON_SECRET>` enviado automaticamente pela Vercel. Há um commit no histórico (`3acd358`) removendo explicitamente um cron de intervalo horário incompatível com o plano Hobby e consolidando a lógica em crons diários — confirma a regra crítica nº 3 abaixo como já vivida na prática, não só teórica.

---

## 📐 9. Padrões e convenções

- **Server Actions**: cada módulo tem um `actions.ts` próprio (co-localizado com a página ou em `src/app/admin/<módulo>/actions.ts`); toda action que recebe `FormData` valida com Zod antes de tocar no Supabase; toda action chama `requireRole(...)` no próprio corpo (mesmo com página/layout já protegidos, pois a action é um endpoint alcançável por POST direto); erros de validação retornam por campo via `useActionState`, nunca como exceção lançada.
- **Clients Supabase**: `createClient()` (respeita RLS) é o padrão em Server Components/Actions; `createAdminClient()` (bypassa RLS) só em contextos sem sessão — webhooks, crons, rotas públicas de PDF, checagens no proxy.
- **Tratamento de erro**: erro de query tratado inline na própria página; `error.tsx` por segmento como rede de segurança; `loading.tsx` com skeleton (não spinner client-side) para Suspense automático de Server Components.
- **CRUDs de gestão**: página dedicada para criar/editar (`/recurso/novo`, `/recurso/[id]/editar`), não modal.
- **Nomenclatura**: arquivos e pastas em português (domínio de negócio), código (identificadores) em português também, seguindo o idioma predominante do projeto.
- **Autenticação**: diferenciação de papéis via coluna `role` em `profiles` (`admin` | `aluno`, default `aluno`) mais o papel adicional `empresa` (visto em `src/lib/auth/roles.ts`, usado pelo Gênezi Conecta) — sem tabelas separadas por papel. `src/proxy.ts` faz refresh de sessão e roteamento otimista (conveniência de UX); a fronteira de segurança real é `requireRole()`/`requireEmpresa()` em `src/lib/auth/dal.ts`, chamada em todo `layout.tsx` E em toda `page.tsx` das áreas protegidas (Partial Rendering do Next não re-executa o layout em navegação entre rotas irmãs).
- **Duas arquiteturas paralelas de envio de WhatsApp**: sistema legado (`src/lib/mensagens/`, 4 tipos fixos, enum Postgres) e sistema moderno "GênZap" (`src/lib/whatsapp/`, catálogo de templates editável pela tela `/admin/configuracoes/whatsapp`, toggles por `whatsapp_notif_toggles`). Novas automações de WhatsApp devem usar o sistema moderno.
- **PDFs**: gerados com `@react-pdf/renderer` em arquivos `.tsx` (JSX necessário para `renderToBuffer`), servidos por Route Handlers públicas usando o ID do recurso como bearer token implícito; texto de PDF nunca usa emoji (fonte base-14 Helvetica não tem os glifos).

---

## ⚠️ REGRAS CRÍTICAS — LER ANTES DE QUALQUER ALTERAÇÃO

1. **NUNCA rodar `npx supabase db push`.**
   Migrations ficam em `supabase/migrations/` com `-- NÃO APLICADA` no topo. Fernando aplica manualmente pelo SQL Editor do Supabase.

2. **Tabela `alunos` tem grants POR COLUNA (não por tabela).**
   Colunas novas precisam de GRANT manual no SQL Editor. (Nota: `campanha_paginas` e `campanha_respostas` são excepções conhecidas — têm grant de tabela inteira, cobrindo colunas novas automaticamente; verificar caso a caso antes de assumir o padrão de uma ou de outra.)

3. **Vercel Hobby: apenas crons diários.**
   Crons com intervalo < 24h bloqueiam o deploy — já causou um revert real no histórico (commit `3acd358`).

4. **`matriculas.curso_id` é a fonte da verdade do curso do aluno.**
   NÃO usar `turmas.curso_id` para determinar o curso de um aluno (uma turma pode ter múltiplos cursos desde a migration `20261031200000_turma_multiplos_cursos.sql`).

5. **`createAdminClient()` bypassa RLS** — usar só em server actions/rotas seguras (webhooks, crons, rotas com ID-como-bearer-token).
   **`createClient()` respeita RLS** — usar em Server Components, Server Actions normais e componentes cliente.

6. **Todo commit:** `git add -A && git commit && git push origin main`.

---

## 📊 11. Estado atual do desenvolvimento

Total de commits no repositório: **369** (do scaffold inicial `4fe2a63` até o commit mais recente).

### 30 commits mais recentes

```
4913426 feat: campanha — pontuação, PDF resultado, respostas admin, cor borda, escolha única, WhatsApp confirmação, menor de idade
fe5e2da fix: grants para colunas novas em alunos
595bcb4 fix: erro ao cadastrar aluno em matriculas
c92954e fix: logica de cursos por turma - cada aluno segue o curso escolhido na matricula
1a8485c fix: visibilidade dos campos de formulario nas paginas publicas
c0875a3 feat: logo na pagina publica de agendamento
0e1aa74 feat: agendamentos - feriados por periodo, horario inicio/fim, campanha, visual personalizado, confirmacao WhatsApp
8a15c4f feat: multiplos cursos por turma
c99b752 feat: auditoria de notificacoes - log de envios, painel de diagnostico, alunos sem lembrete
3406e4d feat: envio manual de lembrete de aula e falta no dropdown WhatsApp da lista de matriculas
fd0f325 feat: filtros de turma e curso na lista de matriculas
9a95c75 feat: dashboard comercial 2.6 - metricas, funil, grafico leads, agenda hoje, campanhas ativas, retornos
19f2e6d feat: campanha 2.5 - templates prontos, preview mobile, responsividade, OG tags
3acd358 fix: remover cron hourly incompatível com Vercel Hobby, consolidar lembretes no cron diário
5706f46 feat: agendamentos 2.4 - lembretes, remarcacao, feriados, confirmacao melhorada
dbfc12b feat: email 2.3 - fix descadastros, editor visual, segmentacao leads, relatorios
d697232 feat: CRM 2.2 - integracoes agendamento->lead, UTM tracking, indicadores campanhas
a6735c3 feat: CRM 2.1 - leads profissionalizado, historico, retornos pendentes, checklist campanhas
d9e755f feat: planos anuais + cobranca empresa R$ 29,90/ano
5dee74c feat: contratação, rejeição, notificações Telegram + candidato vê status
189d826 fix: PGRST200 - embed perfis_conecta->alunos quebrado, corrigido para profiles direto
3bec6c0 fix: empresa não via candidaturas - corrigir query/sessão
3d509e2 fix: conecta plano único básico + filtro de turmas por curso e dia
2cefbea fix: conecta - backfill de nome do aluno em perfis_conecta
bb37374 feat: conecta - candidatura interna, nome empresa, mobile empresa, logo, candidatos visiveis
916ed66 feat: conecta - corrigir fluxo pos-pagamento, empresa sem codigo, API IBGE cidades, logo, excluir candidato
7d27b59 feat: gestão de termos legais do Gênezi Conecta no admin
16015a3 feat: Telegram para Conecta + configurações admin
b329b84 feat: redesign página pública Gênezi Conecta com cards por cidade, FAQ e termos
3829caa feat: proteção de idade + código acesso empresa + botão WhatsApp Conecta
```

### Último módulo entregue

O commit mais recente (`4913426`) entregou um pacote de melhorias no módulo de **páginas de campanha** (`/admin/comercial/paginas-campanha`): sistema de pontuação configurável, PDF do resultado da inscrição, melhorias na tela admin de respostas (filtro por aprovação, contagem, impressão), cor de borda configurável dos campos do formulário público, confirmação via WhatsApp (template editável `campanha_confirmacao`) e tratamento de inscrição de menor de idade (dados do responsável). Os commits imediatamente anteriores mostram uma sequência de trabalho recente concentrada em três frentes: **Gênezi Conecta** (bolsa de empregos, muitos commits de `fix` seguidos de `feat`, indicando um módulo em estabilização), **CRM/comercial** (funil de leads, campanhas, dashboard, versionado numericamente "2.1" a "2.6") e **agendamentos públicos** (lembretes, remarcação, confirmação WhatsApp, visual personalizado).

---

*Documento gerado por leitura direta do código-fonte, `package.json`, `tsconfig.json`, `vercel.json`, `.env.example`, `supabase/migrations/` e `git log` — não apresenta informação inferida sem verificação no repositório real.*
