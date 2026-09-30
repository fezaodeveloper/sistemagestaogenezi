# Documentação Técnica — Sistema Gestão Gênezi

> Última atualização: 2026-09-25. Este documento é gerado a partir do estado real do código e das migrations no momento da escrita — sempre confira o código-fonte quando algo aqui parecer desatualizado, e atualize este arquivo junto com mudanças estruturais relevantes (nova integração, novo módulo, mudança de convenção).

## Índice

1. [Visão geral do projeto](#1-visão-geral-do-projeto)
2. [Arquitetura](#2-arquitetura)
3. [Módulos do sistema](#3-módulos-do-sistema)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Crons (vercel.json)](#5-crons-verceljson)
6. [Migrations](#6-migrations)
7. [Integrações externas](#7-integrações-externas)
8. [Padrões de desenvolvimento](#8-padrões-de-desenvolvimento)
9. [Segurança](#9-segurança)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Visão geral do projeto

| | |
|---|---|
| **Nome** | Sistema Gestão Gênezi |
| **Descrição** | SaaS de gestão escolar para escola de informática — matrículas, financeiro, portal do aluno (LMS), gamificação, CRM/marketing, automações de WhatsApp/SMS/e-mail/Telegram, e um marketplace de vagas (Gênezi Conecta). |
| **Stack** | Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (preset `nova`: Base UI + Lucide + Geist/Figtree), Supabase Cloud (Postgres + Auth + Storage), Vercel (deploy + Cron Jobs) |
| **Repositório** | `github.com/fezaodeveloper/sistemagestaogenezi` |
| **Produção** | `sistemagestaogenezi.vercel.app` |
| **Supabase (projeto)** | `rwyyxofxnexftsqaimcw.supabase.co` |
| **Gerenciador de pacotes** | npm |

Dependências centrais (`package.json`): `next` 16.2.12, `react`/`react-dom` 19.2.4, `@supabase/ssr` + `@supabase/supabase-js`, `zod` 4, `@base-ui/react` (componentes shadcn), `@tiptap/*` (editor de texto rico), `@react-pdf/renderer` + `pdf-lib` (geração de PDF — certificados, propostas), `recharts` (gráficos do dashboard), `web-push` (notificações PWA), `stripe` (um dos gateways), `xlsx` (exportações), `nodemailer` (fallback SMTP do módulo de e-mail).

---

## 2. Arquitetura

### 2.1 Estrutura de pastas

```
src/
  app/                        # App Router — rotas
    admin/                    # Área do gestor (tema admin-dark)
    aluno/                    # Portal do aluno (tema dark)
    api/                      # Route Handlers: cron/, webhooks/, v1/ (API pública), whatsapp/, telegram/
    agendar/[slug]/           # Página pública de agendamento
    campanha/[slug]/          # Landing page pública de campanha
    captacao/                 # Página pública de captação de leads
    conecta/, empresa/        # Gênezi Conecta (portal do candidato e da empresa)
    entrar/, login/, auth/    # Autenticação
    descadastro/[token]/      # Opt-out público de e-mail marketing
  components/
    ui/                       # Gerados pelo shadcn — não editar manualmente além de tema
    admin/, aluno/, empresa/, conecta/, chat/, campanha/, pixels/, gamificacao/, leads/, pdf/
  lib/                        # Lógica de servidor e utilitários — um subdiretório por domínio
    supabase/                 # Clients (server.ts autenticado, admin.ts service_role)
    auth/                     # requireRole, is_admin, roles
    <domínio>/                # ex.: financeiro/, whatsapp/, gateways/, email/, matriculas/...
supabase/
  migrations/                 # SQL versionado, aplicado manualmente no Supabase (nunca via CLI/CI aqui)
```

Cada domínio em `src/lib/<dominio>/` normalmente separa **tipos/schema** (client-safe, sem `"server-only"`) de **lógica de acesso a dados** (`"server-only"`, importa `@/lib/supabase/*`) — necessário sempre que um Client Component precisa dos tipos/constantes mas não pode importar código server-only (ex.: `templates.ts`/`render.ts`, `fluxos-tipos.ts`/`fluxos.ts` no módulo WhatsApp).

### 2.2 Padrão de autenticação

- Supabase Auth (`@supabase/ssr`) com dois clients: `src/lib/supabase/server.ts` (respeita a sessão do cookie, sujeito a RLS) e `src/lib/supabase/admin.ts` (`service_role`, bypassa RLS — só usado em contexto de servidor que genuinamente precisa disso: crons, páginas públicas, operações administrativas em lote).
- Diferenciação de papel via coluna `role` em `profiles` (`admin` | `aluno`, default `aluno`) e, num fluxo separado, `empresa` (Gênezi Conecta) — sem tabelas por papel.
- `src/proxy.ts` faz o refresh de sessão e um roteamento otimista por role — é conveniência de UX, **não** a fronteira de segurança.
- A checagem de verdade é `requireRole()` (`src/lib/auth/dal.ts`), usando `getClaims()` + a função Postgres `is_admin()` (`security definer`, evita recursão de RLS). Chamada tanto no `layout.tsx` de cada área quanto em **cada `page.tsx` individualmente** — por causa do Partial Rendering do Next.js, layouts não re-renderizam (logo não re-checam auth) em navegação client-side entre rotas irmãs. `requireRole()` usa `cache()` do React, então chamar duas vezes na mesma request não duplica a query.

### 2.3 Padrão de Server Actions

- Toda Server Action que recebe input de formulário valida com **Zod** antes de tocar no Supabase.
- Toda Server Action chama `requireRole(...)` (ou `requireEmpresa()`) no próprio corpo — é um endpoint alcançável por POST direto, precisa se autoproteger mesmo com a página que a invoca já protegida por layout.
- CRUDs de gestão usam página dedicada para criar/editar (`/recurso/novo`, `/recurso/[id]/editar`), não modal.
- Erros de validação retornam por campo via `useActionState`, nunca como exceção lançada pro cliente.

### 2.4 Padrão de migrations SQL

- Arquivo por mudança, nomeado `YYYYMMDDHHmmss_descricao.sql`, em `supabase/migrations/`. A data reflete quando a migration foi **escrita**, não necessariamente aplicada.
- **Nunca aplicadas automaticamente** — são escritas, revisadas e aplicadas manualmente no SQL Editor do Supabase (não há pipeline de CI que rode `supabase db push`).
- Toda tabela nova: `enable row level security` + policies explícitas por operação (select/insert/update/delete) + `grant`s explícitos por coluna/operação para `authenticated` (nunca depender de grant default do Postgres).
- Funções que precisam rodar com mais privilégio que o chamador (ex.: contornar recursão de RLS, ou permitir um insert condicional sem abrir a tabela inteira) usam `security definer` com `set search_path = ''` — evita SQL injection via search_path e evita depender de objetos fora de `public`.

### 2.5 Convenção `created_by` e RLS

- Toda tabela tem `created_by uuid not null references public.profiles (id) default auth.uid()`.
- Quando `created_by` só é preenchido por um **admin** (a maioria dos casos), o FK padrão (sem `on delete cascade`) é seguro — uma conta admin nunca é excluída pelo app.
- Quando uma tabela permite que um papel **não-admin** insira nela (aluno respondendo quiz, comentando, avaliando aula, marcando aula como concluída), `created_by` aponta pra conta desse aluno — e contas de aluno **são** excluídas rotineiramente (`deleteAluno` em `/admin/alunos`). Sem `on delete cascade` nesse caso, excluir o aluno falha (violação de FK). **Toda tabela nova cujo `created_by` possa ser preenchido por um papel não-admin precisa de `on delete cascade` na FK de `created_by` desde a criação** (bug real, encontrado e corrigido em `aulas_concluidas`, migration `20260814110000`; replicado corretamente desde então em `aula_comentarios` e `aula_avaliacoes`).
- `service_role` bypassa RLS mas **não** bypassa grants de tabela — toda tabela usada pelo client admin também precisa de `grant` explícito para `service_role`.

### 2.6 Padrão de criptografia (`GATEWAYS_ENCRYPTION_KEY`)

Módulo único e reutilizado, `src/lib/gateways/crypto.ts` (AES-256-GCM — confidencialidade + detecção de adulteração, formato `enc:v1:<iv>:<tag>:<texto cifrado>` em base64):

- A chave (`GATEWAYS_ENCRYPTION_KEY`, uma string qualquer — vira uma chave de 32 bytes via SHA-256) vem **só** do ambiente, nunca do banco.
- Apesar do nome do módulo sugerir só gateways de pagamento, é reutilizado por **qualquer** credencial sensível guardada em tabela de configuração: `gateways_config`, `whatsapp_config` (chave da Evolution API), `integracoes_sms_config` (IntegraX), `spedy_integracoes`, `email_config` (SMTP alternativo ao Resend).
- Um valor sem o prefixo `enc:v1:` é tratado como texto puro (semente de migration/dado legado) e recriptografado na próxima gravação.
- **Nunca trocar a chave depois que credenciais já foram salvas** — elas deixam de ser legíveis (não há re-criptografia automática em massa).

---

## 3. Módulos do sistema

### Autenticação e perfis
- **Descrição:** login, sessão, diferenciação admin/aluno/empresa, DAL de autorização.
- **Rotas:** `/entrar` (aluno/admin), `/login` (redireciona conforme role), `/auth/callback`, `/empresa/login`.
- **Tabelas:** `profiles`.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

### Alunos e matrículas
- **Descrição:** cadastro de alunos/responsáveis, matrícula em turma/curso, campos financeiros da matrícula (taxa, parcelamento).
- **Rotas:** `/admin/alunos`, `/admin/matriculas`, `/admin/matriculas/nova`, `/admin/matriculas/[id]`, `/admin/matriculas/[id]/editar`, `/admin/turmas*`.
- **Tabelas:** `alunos`, `responsaveis`, `turmas`, `matriculas`.
- **Env vars:** nenhuma própria (financeiro da matrícula usa as env vars de Gateways/Asaas).

### Cursos, módulos e aulas
- **Descrição:** estrutura de conteúdo — curso → módulo → aula → material (PDF/vídeo) → quiz/prova; calendário e liberação sequencial de aulas.
- **Rotas:** `/admin/cursos`, `.../[id]/modulos`, `.../modulos/[moduloId]/aulas`, `.../aulas/[aulaId]/materiais`, `.../aulas/[aulaId]/quiz`, `.../modulos/[moduloId]/prova`, `/admin/cronograma`, `/admin/calendario`.
- **Tabelas:** `cursos`, `modulos`, `aulas`, `materiais`, `quizzes`, `tentativas_quiz`, `provas`, `tentativas_prova`, `presencas`, `calendario_aulas_turma`, `liberacoes_manuais`, `calendario_academico`.
- **Env vars:** nenhuma (storage buckets `cursos`, `modulos`, `materiais`).

### Financeiro e parcelas
- **Descrição:** parcelas de matrícula, pagamentos avulsos, gastos, categorias, nota fiscal, relatórios financeiros.
- **Rotas:** `/admin/financeiro`, `/admin/financeiro/avulsos`, `/admin/financeiro/gastos`, `/admin/financeiro/categorias`, `/admin/relatorios/financeiro`.
- **Tabelas:** `parcelas`, `pagamentos_avulsos`, `gastos`, categorias (financeiro/avulsos/gastos).
- **Env vars:** `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`, `GATEWAYS_ENCRYPTION_KEY` (demais gateways).

### Agendamentos
- **Descrição:** páginas públicas de agendamento (captação), confirmação, lembrete D-1 automático (WhatsApp + SMS + Telegram pro admin).
- **Rotas:** `/agendar/[slug]` (público), `/admin/comercial/agendamentos`.
- **Tabelas:** `agendamentos`, `agendamento_paginas`.
- **Env vars:** nenhuma própria — lembretes usam GênZap/IntegraX/Telegram.

### Leads e CRM
- **Descrição:** captação e funil de vendas em Kanban, follow-up automático.
- **Rotas:** `/admin/leads`, `/admin/leads/novo`, `/admin/leads/[id]/editar`.
- **Tabelas:** `leads` (coluna de kanban embutida).
- **Env vars:** nenhuma própria.

### Campanhas de marketing
- **Descrição:** campanhas internas de captação/e-mail marketing, com meta de alunos e métricas.
- **Rotas:** `/admin/comercial/campanhas`, `/admin/email-marketing`, `/admin/email-marketing/nova`, `/admin/email-marketing/[id]`, `/admin/email-marketing/[id]/editar`, `/admin/email-marketing/descadastros`.
- **Tabelas:** `campanhas_marketing`, tabelas de e-mail marketing (envio/estatísticas), `email_descadastros`.
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `DESCADASTRO_SECRET`.

### Páginas de campanha
- **Descrição:** landing pages públicas com formulário de resposta, customizáveis (cor, fonte, tipografia, cards de destaque), com pixels de rastreamento injetados.
- **Rotas:** `/campanha/[slug]` (público), `/admin/comercial/paginas-campanha`, `.../[id]/respostas`.
- **Tabelas:** `campanha_paginas`, respostas de campanha.
- **Env vars:** nenhuma direta (config de pixel vem do banco).
- **Nota de arquitetura:** usa `createAdminClient()` (`service_role`) mesmo sendo uma rota pública — ver [Troubleshooting §10.2](#102-jwt-failed-verification-em-página-pública).

### Portal do aluno (LMS)
- **Descrição:** área logada do aluno — cursos matriculados, player de aula, progresso, financeiro, contrato, perfil.
- **Rotas:** `/aluno`, `/aluno/cursos/[id]`, `.../modulos/[moduloId]`, `.../aulas/[aulaId]`, `/aluno/financeiro`, `/aluno/contrato`, `/aluno/perfil`, `/aluno/mensagens`.
- **Tabelas:** `matriculas`, `aulas_concluidas` (+ todas as de conteúdo listadas acima).
- **Env vars:** nenhuma própria.
- **Player de vídeo:** componente customizado (`src/components/aluno/youtube-player.tsx`) sobre a YouTube IFrame API — sem branding do YouTube, com atalhos de teclado, seletor de velocidade/qualidade, retomar de onde parou e miniplayer flutuante (ver [§7.10](#710-youtube-iframe-api)).

### Gamificação e prêmios
- **Descrição:** pontos por evento (aula concluída, quiz, presença...), badges, avatares, ofensiva (streak), loja de créditos/prêmios com resgate e entrega.
- **Rotas:** `/aluno/ranking`, `/aluno/creditos`, `/admin/premios`, `/admin/premios/novo`, `/admin/resgates`, `/admin/engajamento/recompensas`, aba Gamificação/Calculadora em `/admin/configuracoes`.
- **Tabelas:** eventos de pontuação, `badges`, `avatares`, ofensivas, `creditos`, `premios`, `resgates`, `medalha_recompensas`.
- **Env vars:** nenhuma.

### Comentários e avaliações
- **Descrição:** comentários em aula com moderação configurável; avaliação de aula com estrelas (1-5) + comentário opcional, com notificação Telegram e métricas agregadas pro admin.
- **Rotas:** inline na página da aula (`/aluno/cursos/.../aulas/[aulaId]`), `/admin/configuracoes/portal-aluno/comentarios`, `/admin/academico/avaliacoes`.
- **Tabelas:** `aula_comentarios`, `aula_avaliacoes`.
- **Env vars:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (notificação de nova avaliação).

### Comunidade
- **Descrição:** fórum do aluno por categorias, posts, respostas e curtidas.
- **Rotas:** `/aluno/comunidade`, `/aluno/comunidade/[categoriaId]`, `/aluno/comunidade/nova`, `/aluno/comunidade/post/[postId]`.
- **Tabelas:** categorias, posts, respostas e likes de comunidade.
- **Env vars:** nenhuma. Recurso desligado por padrão (flag em `configuracoes`).

### Certificados
- **Descrição:** emissão automática (ao concluir curso, se critérios de nota/frequência baterem) ou manual, template customizável (layout, cor, assinatura do diretor), download em PDF.
- **Rotas:** `/admin/certificados`, `/admin/certificados/template`, `/aluno/certificados`, `/aluno/certificados/[id]/download`.
- **Tabelas:** `certificados`.
- **Env vars:** nenhuma (`@react-pdf/renderer`/`pdf-lib` geram o PDF localmente, sem serviço externo).

### Gateways de pagamento
- **Descrição:** cadastro de credenciais (criptografadas) de múltiplos gateways de cobrança recorrente/avulsa.
- **Rotas:** `/admin/configuracoes/gateways`.
- **Tabelas:** `gateways_config`.
- **Env vars:** `GATEWAYS_ENCRYPTION_KEY`; endpoints de webhook próprios por gateway (ver [§7](#7-integrações-externas)).

### E-mail (provedor + marketing)
- **Descrição:** configuração do provedor de envio (Resend, com fallback SMTP), templates transacionais editáveis, campanhas de e-mail marketing com opt-out.
- **Rotas:** `/admin/configuracoes/email`, `/admin/email-marketing*`.
- **Tabelas:** `email_config`, `email_templates`, tabelas de e-mail marketing, `email_descadastros`.
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GATEWAYS_ENCRYPTION_KEY` (credenciais SMTP alternativas), `DESCADASTRO_SECRET`, `NEXT_PUBLIC_SITE_URL`.

### WhatsApp / GênZap
- **Descrição:** conexão própria via Evolution API (QR code, status, anti-banimento), 13+ templates unificados por evento (agendamento, cobrança, lead), e um construtor visual de fluxos (canvas drag-and-drop com nós de espera/condição, histórico de execuções).
- **Rotas:** `/admin/configuracoes/whatsapp`, `/admin/whatsapp-fluxos`, `/admin/whatsapp-fluxos/[id]`.
- **Tabelas:** `whatsapp_config`, `whatsapp_templates`, `whatsapp_fluxos` (+ execuções de fluxo).
- **Env vars:** `GATEWAYS_ENCRYPTION_KEY` (a API key da Evolution API é criptografada no banco, não fica em env var).

### SMS (IntegraX)
- **Descrição:** envio de SMS transacional e templates editáveis, com recuperação escalonada de leads (sequência de mensagens por tempo desde o cadastro).
- **Rotas:** aba IntegraX em `/admin/configuracoes/apps`.
- **Tabelas:** `integracoes_sms_config`, `sms_templates`, `sms_recuperacao_log`.
- **Env vars:** `INTEGRAX_SMS_URL`, `GATEWAYS_ENCRYPTION_KEY` (credenciais da conta IntegraX).

### Pixels e rastreamento
- **Descrição:** injeção de pixels (Meta/Google/etc.) nas páginas públicas de campanha/captação, com eventos de cliente configuráveis.
- **Rotas:** sem rota própria — injetado em `/campanha/[slug]` e `/captacao`; configurado dentro de `/admin/configuracoes`.
- **Tabelas:** `pixels_config`.
- **Env vars:** nenhuma.

### Webhooks de saída
- **Descrição:** disparo de eventos do sistema (matrícula criada, pagamento recebido etc.) para URLs externas configuráveis pelo admin.
- **Rotas:** configurado em `/admin/api` (junto com API pública) ou `/admin/configuracoes/apps`.
- **Tabelas:** configuração de webhooks de saída + log de disparo/métricas.
- **Env vars:** nenhuma.

### Spedy NF-e
- **Descrição:** emissão de nota fiscal integrada ao recebimento de parcela.
- **Rotas:** aba Spedy em `/admin/configuracoes/apps`.
- **Tabelas:** `spedy_integracoes`, `parcelas.spedy_nota_id`.
- **Env vars:** `GATEWAYS_ENCRYPTION_KEY` (credenciais Spedy).

### Notificações push (PWA)
- **Descrição:** Web Push (service worker do PWA) pro admin e pro aluno.
- **Rotas:** sem rota própria — botão de assinatura nos layouts de `/admin` e `/aluno`; `manifest.json`.
- **Tabelas:** `push_subscriptions_alunos`; chaves VAPID guardadas em `configuracoes` (geradas e salvas via tela do admin, não em env var).
- **Env vars:** nenhuma fixa.

### Telegram
- **Descrição:** canal de notificação interna pro admin (bot `@genezi_educacao_bot`) — pagamento recebido, matrícula criada, resumo diário/semanal/mensal, avaliação de aula, avisos de presença pendente, etc. Ponto de entrada único: `src/lib/telegram.ts` → `src/lib/telegram/client.ts`.
- **Rotas:** nenhuma rota própria (usado pelo motor de automações e por crons); `/api/telegram/teste` pra teste manual.
- **Tabelas:** nenhuma própria.
- **Env vars:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- **Regra de segurança:** `parse_mode` é HTML — todo valor vindo do banco/usuário interpolado numa mensagem **precisa** passar por `escapeHtml()` antes, senão um `<`/`>`/`&` no meio de um nome derruba a mensagem inteira (bug real, corrigido em vários handlers).

### Gênezi Conecta
- **Descrição:** marketplace de vagas — empresas se cadastram (com assinatura paga via Asaas), publicam vagas, alunos/candidatos se candidatam; cidades atendidas configuráveis.
- **Rotas:** `/conecta/*` (cadastro, vagas, criar-senha, aguardando-pagamento), `/empresa/*` (login, painel, vagas, candidatos, perfil, notificações), `/admin/conecta`, `/admin/conecta/vagas`, `/admin/conecta/candidatos`, `/admin/conecta/cidades`, `/aluno/conecta`.
- **Tabelas:** empresas/vagas/candidaturas do Conecta, `conecta_cidades`, log de webhook do Conecta.
- **Env vars:** `ASAAS_API_KEY` (assinatura da empresa), `GATEWAYS_ENCRYPTION_KEY`.

### Backup
- **Descrição:** exportação de dados do sistema (inclui rotina que toca chaves VAPID/push) para backup manual pelo admin.
- **Rotas:** aba Backup em `/admin/configuracoes`.
- **Tabelas:** nenhuma própria — lê tabelas existentes.
- **Env vars:** nenhuma.

---

## 4. Variáveis de ambiente

> Fonte: `.env.example` + varredura de todo uso de `process.env.*` em `src/`. **Nem toda integração usa env var** — várias (gateways de pagamento, Evolution API/WhatsApp, IntegraX/SMS, Spedy/NF-e, e-mail SMTP alternativo, VAPID/push, pixels) guardam a configuração **no banco** (tabelas de config, credenciais sensíveis criptografadas com `GATEWAYS_ENCRYPTION_KEY`), configuradas por tela no `/admin`. Isso é intencional — permite trocar credencial sem redeploy.

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública, exposta ao browser. |
| `SUPABASE_SECRET_KEY` | Chave secreta, uso exclusivo server-side — bypassa RLS, nunca expor ao browser. |
| `CRON_SECRET` | O Vercel Cron envia esse valor como `Authorization: Bearer <valor>`; toda Route Handler de cron rejeita chamada sem esse header batendo. |
| `TELEGRAM_BOT_TOKEN` | Token do bot `@genezi_educacao_bot`. |
| `TELEGRAM_CHAT_ID` | ID do chat/grupo que recebe as notificações. |
| `ASAAS_API_KEY` | Chave de API do Asaas (sandbox ou produção). |
| `ASAAS_API_URL` | URL base da API Asaas (default `https://api.asaas.com/v3`). |
| `GATEWAYS_ENCRYPTION_KEY` | Chave de criptografia (AES-256-GCM) de toda credencial sensível guardada em tabela de configuração — ver [§2.6](#26-padrão-de-criptografia-gateways_encryption_key). **Nunca trocar depois de salvar credenciais.** |
| `ASAAS_WEBHOOK_TOKEN` | Valor esperado no header `asaas-access-token` dos webhooks do Asaas. |
| `RESEND_API_KEY` | Envio de e-mail transacional via Resend. Sem ela, o envio é ignorado (best-effort), não bloqueia fluxo nenhum. |
| `RESEND_FROM_EMAIL` | Remetente, ex. `Gênezi Educação <no-reply@seudominio.com.br>`. |
| `INTEGRAX_SMS_URL` | URL base da API de SMS IntegraX. |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site — usada em links de e-mail (descadastro) e em callbacks/redirects. |
| `DESCADASTRO_SECRET` | Assina o token de opt-out de e-mail marketing (`/descadastro/[token]`). |

---

## 5. Crons (`vercel.json`)

Regra: Vercel usa UTC. Brasília = UTC-3, então horário Brasília = horário UTC − 3h.

| Rota | UTC | Brasília | O que faz |
|---|---|---|---|
| `/api/cron/lembretes-aula` | `11:00` diário | 08:00 | Lembrete de aula do dia seguinte. |
| `/api/cron/resumo-diario` | `10:30` diário | 07:30 | Resumo diário (financeiro, acadêmico, alunos, leads) via Telegram. |
| `/api/cron/relatorio-semanal` | `21:00` sexta | 18:00 (sex) | Relatório semanal consolidado via Telegram. |
| `/api/cron/verificar-atrasos` | `11:00` diário | 08:00 | Marca parcelas vencidas como atrasadas, dispara cobrança WhatsApp por faixa de atraso, avisa parcela vencendo amanhã, contrato parado, lead sem contato. |
| `/api/cron/calcular-evasao` | `12:00` diário | 09:00 | Recalcula índice de risco de evasão por matrícula, alerta de baixa frequência por turma, atualiza ofensiva (streak) de gamificação. |
| `/api/cron/resumo-mensal` | `10:00` dia 1 do mês | 07:00 | Resumo mensal consolidado via Telegram. |
| `/api/cron/followup-leads` | `12:00` diário | 09:00 | Follow-up automático de leads por WhatsApp (limite de tentativas configurável). |
| `/api/cron/lembrete-agendamentos` | `21:00` diário | 18:00 | Lembrete D-1 de agendamento confirmado (WhatsApp ao cliente + Telegram ao admin + SMS). |
| `/api/cron/aviso-presenca` | `22:00` diário | 19:00 | Avisa turmas com aula hoje que ainda não tiveram presença registrada. |
| `/api/cron/email-campanhas` | `13:00` diário | 10:00 | Dispara campanhas de e-mail agendadas e continua envios em andamento. |
| `/api/cron/sms-recuperacao` | `14:00` diário | 11:00 | Recuperação escalonada de leads por SMS. |
| `/api/cron/whatsapp-fluxos` | `15:00` diário | 12:00 | Retoma execuções de fluxo de WhatsApp paradas num nó "aguardar" cujo prazo já venceu. |

> Todos os crons diários (não semanal/mensal) compartilham a mesma limitação do **plano Hobby da Vercel: só uma execução por dia, sem granularidade de hora/minuto** — documentado inline em vários dos route handlers (`sms-recuperacao`, `email-campanhas`, `whatsapp-fluxos`). Consequência prática: um "aguardar 2 horas" num fluxo de WhatsApp, por exemplo, só é retomado na próxima execução diária do cron, não com precisão de horas.

---

## 6. Migrations

Ordem cronológica (nome do arquivo = quando foi **escrita**; aplicação no banco é manual). Total: **136 migrations**.

| Data | Arquivo | O que faz |
|---|---|---|
| 2026-07-31 | `create_profiles` | Cria `profiles` (perfil de todo usuário autenticado) via trigger em `auth.users`. |
| 2026-07-31 | `grant_service_role_profiles` | Grant de `profiles` pro `service_role`. |
| 2026-07-31 | `add_role_to_profiles` | Coluna `role` (admin/aluno) + função `is_admin()`, base de toda RLS do painel. |
| 2026-08-01 | `create_cursos` | Cria `cursos`. |
| 2026-08-01 | `create_turmas` | Cria `turmas`. |
| 2026-08-01 | `create_alunos` | Cria `alunos` e `responsaveis`. |
| 2026-08-01 | `create_matriculas` | Cria `matriculas`. |
| 2026-08-04 | `create_aulas` | Cria `aulas`. |
| 2026-08-05 | `create_materiais` | Cria `materiais` (PDF/vídeo de aula). |
| 2026-08-06 | `create_presencas` | Cria `presencas`. |
| 2026-08-07 | `add_reposicao_justificativa_presencas` | Campos de reposição/justificativa de falta. |
| 2026-08-08 | `create_modulos` | Cria `modulos`. |
| 2026-08-09 | `create_quizzes` | Cria quizzes e questões por aula. |
| 2026-08-10 | `create_provas` | Cria provas e questões por módulo. |
| 2026-08-11 | `add_aluno_rls_meus_cursos` | RLS: aluno vê os próprios cursos matriculados. |
| 2026-08-12 | `add_aluno_rls_modulos_aulas` | RLS: aluno vê módulos/aulas do curso matriculado. |
| 2026-08-13 | `add_aluno_rls_materiais_storage` | RLS de materiais + storage correspondente. |
| 2026-08-14 | `create_aulas_concluidas` | Conclusão manual de aula pelo aluno. |
| 2026-08-14 | `fix_aulas_concluidas_created_by_cascade` | Corrige `created_by` pra `on delete cascade` (bug real — excluir aluno falhava). |
| 2026-08-15 | `create_quiz_tentativas` | Cria `tentativas_quiz`. |
| 2026-08-15 | `fix_criar_tentativa_quiz_limite` | Corrige function de nova tentativa pra respeitar limite. |
| 2026-08-16 | `create_prova_tentativas` | Cria `tentativas_prova`. |
| 2026-08-17 | `add_cadencia_turmas` | Cadência (dias da semana) da turma. |
| 2026-08-18 | `create_calendario_aulas_turma` | Datas de cada aula por turma (liberação por calendário). |
| 2026-08-18 | `add_liberacao_check_aulas_concluidas` | RLS passa a checar liberação antes do insert. |
| 2026-08-19 | `create_liberacoes_manuais` | Admin libera aula fora da regra padrão pra um aluno. |
| 2026-08-20 | `add_expiracao_matriculas` | Data de expiração de acesso da matrícula. |
| 2026-08-21 | `create_pontos_gamificacao` | Eventos de pontuação. |
| 2026-08-22 | `create_badges_avatares_streak` | Badges, avatares e ofensiva (streak). |
| 2026-08-23 | `create_creditos_premios_resgates` | Créditos, prêmios e resgates. |
| 2026-08-24 | `fix_resgates_tipo_campos_check` | Corrige check constraint de `resgates`. |
| 2026-08-25 | `add_capa_cursos` | Capa (imagem) de curso. |
| 2026-08-26 | `add_capa_modulos` | Capa de módulo. |
| 2026-08-27 | `create_certificados` | Cria `certificados`. |
| 2026-08-28 | `expand_certificados` | Mais campos (nota, frequência...). |
| 2026-08-29 | `grant_service_role_alunos` | Grant de `alunos` pro `service_role`. |
| 2026-08-30 | `certificado_template_layout` | Layout do template de certificado. |
| 2026-08-31 | `contrato_matricula` | Contrato digital de matrícula. |
| 2026-08-31 | `create_mensagens_whatsapp` | Primeira versão de templates de WhatsApp (pré-GênZap). |
| 2026-08-31 | `assinatura_admin` | Assinatura (imagem) do diretor pro certificado. |
| 2026-09-01 | `categorias_financeiro` | Categorias financeiras. |
| 2026-09-01 | `fix_grant_whatsapp_config_id` | Corrige grant de `whatsapp_config.id` (42501). |
| 2026-09-01 | `foto_aluno` | Foto de perfil do aluno + bucket. |
| 2026-09-01 | `foto_aluno_delete_policy` | Policy de exclusão da foto. |
| 2026-09-02 | `contrato_templates_multiplos` | Múltiplos templates de contrato. |
| 2026-09-02 | `create_leads` | Cria `leads` (CRM). |
| 2026-09-02 | `taxa_matricula` | Taxa de matrícula. |
| 2026-09-03 | `fix_avaliar_certificado_sem_provas` | Corrige emissão automática pra curso sem prova. |
| 2026-09-03 | `premios_estoque_minimo` | Estoque mínimo (alerta) em prêmios. |
| 2026-09-03 | `nota_fiscal` | Campos de nota fiscal. |
| 2026-09-03 | `chat_arquivos` | Anexos do chat interno. |
| 2026-09-04 | `debug_avaliar_certificado` | Logging temporário de debug. |
| 2026-09-04 | `premios_entrega` | Campos de entrega física de prêmio. |
| 2026-09-05 | `revert_avaliar_certificado_debug` | Reverte o logging da migration anterior. |
| 2026-09-05 | `termos` | Termos legais (aceite). |
| 2026-09-06 | `create_chat_interno` | Chat admin↔aluno. |
| 2026-09-06 | `fornecedores` | Cria `fornecedores`. |
| 2026-09-07 | `alunos_campos_expandidos` | Mais campos cadastrais de aluno. |
| 2026-09-07 | `gamificacao_avancada` | Pontos por evento configuráveis. |
| 2026-09-08 | `cursos_valor` | Valor/preço do curso. |
| 2026-09-08 | `medalha_recompensas` | Medalhas de recompensa. |
| 2026-09-08 | `medalha_recompensas_prazo_entrega` | Prazo de entrega em medalha. |
| 2026-09-08 | `matriculas_campos_expandidos` | Mais campos de matrícula. |
| 2026-09-08 | `matricula_status_enum` | Status de matrícula formalizado como enum. |
| 2026-09-08 | `matriculas_taxa_cartao` | Taxa de cartão na matrícula. |
| 2026-09-09 | `turmas_campos_expandidos` | Mais campos de turma. |
| 2026-09-09 | `cursos_catalogo_aluno` | Catálogo público de cursos pro aluno. |
| 2026-09-09 | `limite_pts_dia` | Limite diário de pontos. |
| 2026-09-09 | `historico_alteracoes` | Log de alterações administrativas. |
| 2026-09-09 | `banners_intervalo` | Intervalo de exibição de banners. |
| 2026-09-09 | `turmas_vagas_aluno` | Vagas/lotação visível pro aluno. |
| 2026-09-10 | `calendario_academico` | Calendário acadêmico (feriados/eventos). |
| 2026-09-10 | `acesso_remoto` | Credenciais de acesso remoto (tela admin). |
| 2026-09-11 | `modulo_financeiro` | Expansão do módulo financeiro. |
| 2026-09-11 | `matriculas_asaas_installment` | Parcelamento Asaas na matrícula. |
| 2026-09-12 | `certificado_template_cor_texto` | Cor de texto do template de certificado. |
| 2026-09-12 | `configuracoes_escola` | Cria `configuracoes` (singleton). |
| 2026-09-13 | `treinamentos` | Treinamentos internos da equipe. |
| 2026-09-13 | `empresa_endereco` | Endereço de empresa (Conecta). |
| 2026-09-14 | `motor_automacoes` | `eventos_automacao` — motor de notificações do sistema. |
| 2026-09-14 | `estoque_manutencao_evasao` | Estoque, manutenção (chamados) e índices de evasão. |
| 2026-09-15 | `api_publica` | `api_keys` — API pública `/api/v1/*`. |
| 2026-09-15 | `login_banners` | Banners da tela de login. |
| 2026-09-15 | `login_banners_tipo` | Tipo de banner de login. |
| 2026-09-16 | `banners_tamanho_texto` | Tamanho de texto do banner. |
| 2026-09-16 | `banner_posicao_texto` | Posição de texto do banner. |
| 2026-09-16 | `escola_logo_select_policy` | Policy de select da logo da escola. |
| 2026-09-16 | `entregas_premios_prazo_entrega` | Prazo de entrega de prêmio. |
| 2026-09-16 | `banners_portal` | Banners também no portal do aluno. |
| 2026-09-16 | `termos_editor_rico` | Termos com editor de texto rico (Tiptap). |
| 2026-09-16 | `pontos_inadimplencia` | Penaliza/zera pontos por inadimplência. |
| 2026-09-16 | `genezi_conecta` | Cria o módulo Gênezi Conecta. |
| 2026-09-16 | `conecta_storage` | Buckets de storage do Conecta. |
| 2026-09-17 | `conecta_storage_fix` | Correção nas policies de storage do Conecta. |
| 2026-09-17 | `conecta_webhook_log` | Log de webhooks do Conecta (Asaas). |
| 2026-09-17 | `conecta_cidades` | Cidades atendidas pelo Conecta. |
| 2026-09-17 | `conecta_cidades_estado_livre` | Campo de estado livre em `conecta_cidades`. |
| 2026-09-17 | `configuracoes_conecta_habilitado` | Flag de habilitar/desabilitar o Conecta. |
| 2026-09-17 | `campanhas_marketing` | Cria `campanhas_marketing`. |
| 2026-09-17 | `termos_legais` | Termos públicos (privacidade, LGPD, imagem). |
| 2026-09-17 | `matricula_termo_imagem` | Termo de uso de imagem na matrícula. |
| 2026-09-17 | `push_subscriptions_alunos` | Notificações push (PWA) do aluno. |
| 2026-09-17 | `leads_kanban` | Coluna de kanban em `leads`. |
| 2026-09-18 | `agendamentos` | Cria `agendamentos` e `agendamento_paginas`. |
| 2026-09-18 | `campanhas_paginas` | Cria `campanha_paginas`. |
| 2026-09-18 | `campanha_cor_fonte` | Cor/fonte da página de campanha. |
| 2026-09-18 | `campanha_respostas_estado` | Campo UF na resposta de campanha. |
| 2026-09-18 | `agendamentos_grants_admin` | Grants de `agendamentos` pro admin. |
| 2026-09-18 | `kanban_colunas` | Colunas de kanban configuráveis. |
| 2026-09-18 | `campanhas_marketing_meta_alunos` | Meta de alunos em campanha. |
| 2026-09-18 | `campanha_cards_destaque` | Cards de destaque na página de campanha. |
| 2026-09-19 | `matriculas_edicao_e_limpeza_financeira` | Edição de matrícula com recálculo financeiro. |
| 2026-09-19 | `agendamentos_mensagem` | Recado opcional no agendamento. |
| 2026-09-19 | `campanha_tipografia` | Tipografia da página de campanha. |
| 2026-09-20 | `gateways_config` | Credenciais criptografadas de gateway de pagamento. |
| 2026-09-20 | `webhooks_saida` | Config de webhooks de saída. |
| 2026-09-20 | `integracoes_sms_config` | Config de SMS (IntegraX). |
| 2026-09-20 | `pixels_config` | Config de pixels de rastreamento. |
| 2026-09-20 | `spedy_integracoes` | Config Spedy (NF-e). |
| 2026-09-20 | `parcelas_spedy_nota_id` | Campo de nota Spedy em `parcelas`. |
| 2026-09-20 | `email_config` | Config do provedor de e-mail. |
| 2026-09-20 | `email_templates` | Templates de e-mail editáveis. |
| 2026-09-20 | `email_marketing` | Campanhas de e-mail marketing. |
| 2026-09-20 | `email_descadastros` | Opt-out de e-mail. |
| 2026-09-20 | `portal_login_config` | Rodapé/aparência da tela de login. |
| 2026-09-21 | `aula_comentarios` | Comentários em aula, com moderação. |
| 2026-09-21 | `comunidade` | Fórum do aluno. |
| 2026-09-21 | `conquistas_personalizadas` | Conquistas (separado de badges). |
| 2026-09-21 | `personalizacao_visual` | Logos, cores, ícones PWA. |
| 2026-09-21 | `sms_templates` | Templates de SMS editáveis. |
| 2026-09-21 | `sms_recuperacao_log` | Log de recuperação escalonada por SMS. |
| 2026-09-22 | `whatsapp_genzap` | `whatsapp_config` — GênZap Fase 1 (Evolution API). |
| 2026-09-23 | `whatsapp_templates` | `whatsapp_templates` — GênZap Fase 2 (templates unificados). |
| 2026-09-24 | `aula_avaliacoes` | Avaliação de aula com estrelas. |
| 2026-09-24 | `whatsapp_fluxos` | GênZap Fase 3 — construtor visual de fluxos. |
| 2026-09-24 | `fix_aula_avaliacoes_insert_policy` | Hardening da policy de insert (fallback se `aluno_acessa_aula` não existir). |

> `aula_avaliacoes` e `whatsapp_fluxos` compartilham o mesmo timestamp (`20260924100000`) — coincidência de terem sido criadas em paralelo em branches diferentes (`main`/`develop`) e depois mescladas; não há colisão real (nomes de arquivo diferentes), a ordem alfabética entre elas é estável.

---

## 7. Integrações externas

### 7.1 Supabase
Auth (login/sessão via `@supabase/ssr`), Database (Postgres + RLS), Storage (buckets privados com signed URL de curta duração pra conteúdo protegido: `materiais`, `certificados`, `cursos`, `modulos`, `premios`, `fotos-alunos`, `assinaturas`, `escola-logo`, `login-banners`, `chat-arquivos`, `campanha-paginas`, `campanhas-marketing`, `conquistas-badges`, `curriculos-conecta`, `logos-conecta`, `notas-fiscais`, `premios-digitais`, `certificado-template`), Realtime (não usado extensivamente — a maior parte da UI usa Server Actions + `revalidatePath`).

### 7.2 Vercel
Deploy contínuo a partir de `main`, Cron Jobs (`vercel.json`, ver [§5](#5-crons-verceljson)), variáveis de ambiente do projeto (Production/Preview/Development).

### 7.3 Asaas
Cobranças (financeiro e assinatura de empresa no Gênezi Conecta). Webhook em `/api/webhooks/asaas` (protegido por `ASAAS_WEBHOOK_TOKEN`) e `/api/webhooks/asaas-conecta`.

### 7.4 Evolution API (WhatsApp)
Servidor self-hosted de WhatsApp por trás do GênZap. Credenciais (URL da instância + API key, criptografada) ficam em `whatsapp_config`. Cliente em `src/lib/whatsapp/evolution.ts`.

### 7.5 Resend
E-mail transacional. Cliente em `src/lib/resend/client.ts`. Alternativa SMTP configurável via `email_config` (credenciais criptografadas).

### 7.6 Telegram Bot API
Notificações internas pro admin (ver [módulo Telegram](#telegram)).

### 7.7 IntegraX (SMS)
SMS transacional + recuperação de leads. `INTEGRAX_SMS_URL` + credenciais criptografadas em `integracoes_sms_config`.

### 7.8 Spedy (NF-e)
Emissão de nota fiscal. Credenciais criptografadas em `spedy_integracoes`.

### 7.9 Google Fonts
Via `next/font/google` (`Figtree`, `Geist_Mono`) em `src/app/layout.tsx` — self-hosted pelo Next no build, sem chamada externa em runtime.

### 7.10 YouTube IFrame API
Script `https://www.youtube.com/iframe_api`, carregado dinamicamente pelo player customizado do portal do aluno (`src/components/aluno/youtube-player.tsx`) — não usa `@types/youtube`, tipos mínimos declarados manualmente. Outros gateways de pagamento (Stripe, Mercado Pago, PagarMe, Efí) também têm adapter próprio em `src/lib/gateways/adapters/` e webhook dedicado em `/api/webhooks/<gateway>`.

---

## 8. Padrões de desenvolvimento

### 8.1 Como criar nova rota no admin
1. `src/app/admin/<recurso>/page.tsx` — Server Component, chama `requireRole("admin")` no topo mesmo com o layout já protegendo.
2. `loading.tsx` (skeleton, não spinner) e `error.tsx` (rede de segurança) no mesmo segmento.
3. CRUD com página dedicada: `/admin/<recurso>/novo`, `/admin/<recurso>/[id]/editar` — não modal.
4. `actions.ts` ao lado da página: cada Server Action valida com Zod e chama `requireRole("admin")` no próprio corpo.
5. Adicionar o item em `src/components/admin/admin-nav-groups.tsx` (array `GROUPS`), no grupo temático certo.
6. Se a tabela é nova: migration com RLS + grants (ver [§2.4](#24-padrão-de-migrations-sql)).

### 8.2 Como criar nova migration
1. Arquivo novo em `supabase/migrations/`, nome `YYYYMMDDHHmmss_descricao.sql` com timestamp maior que o último existente.
2. Comentário no topo explicando o "porquê", não só o "o quê" (convenção forte neste projeto — a maioria das migrations tem 3-10 linhas de comentário de contexto antes do SQL).
3. RLS + grants explícitos desde o create (nunca depender de default).
4. Se `created_by` puder ser preenchido por não-admin: `on delete cascade` desde a criação (ver [§2.5](#25-convenção-created_by-e-rls)).
5. **Nunca aplicar a migration** — só criar o arquivo e avisar que está pendente de aplicação manual.

### 8.3 Como adicionar novo evento de WhatsApp
1. Template novo em `whatsapp_templates` (via tela `/admin/configuracoes/whatsapp` ou seed na migration).
2. Função de disparo em `src/lib/whatsapp/eventos.ts` (`notificarWhatsapp<Evento>`), que resolve o template certo e chama `src/lib/whatsapp/enviar.ts`.
3. Chamar essa função no ponto do fluxo onde o evento acontece (Server Action, handler de webhook ou cron) — sempre com tratamento best-effort (nunca lançar e derrubar o fluxo principal).
4. Se o evento precisa ser usável dentro do construtor visual de fluxos: registrar em `src/lib/whatsapp/fluxos-tipos.ts`.

### 8.4 Como adicionar novo template de e-mail
1. Linha nova em `email_templates` (tela `/admin/configuracoes/email` ou seed).
2. Renderização/variáveis em `src/lib/email/` (ver `templates.ts`/`render.ts` — mesmo padrão de split client-safe / server-only do WhatsApp).
3. Disparo via `src/lib/email/eventos.ts`, sempre best-effort (Resend ausente não pode quebrar o fluxo).

### 8.5 Convenções de nomenclatura
- Nomes de variável, função e comentário **em português**; nomes de tipo/campo técnico e nomes já estabelecidos pelo framework (`className`, `useState`...) em inglês.
- Arquivos `kebab-case.tsx`/`kebab-case.ts`.
- Componentes shadcn ficam em `src/components/ui` e não são editados manualmente além de customização de tema/densidade — compor por cima.
- Sem `any` implícito — tipar props, retornos de função exportada e resposta de API.

### 8.6 Workflow git (main + develop)
Duas branches de longa duração observadas no histórico: `develop` acumula features maiores (ex.: GênZap Fase 3) antes de ir pra `main`, com merges frequentes de `main` de volta pra `develop` pra mantê-la atualizada; o merge final de `develop` pra `main` normalmente é fast-forward (ver [Troubleshooting §10.7](#107-merge-conflitante-entre-main-e-develop)). Não há um documento formal prescrevendo essa política — é a convenção observada; confirme com o time antes de assumir uma regra rígida de quando usar cada branch.

### 8.7 Como fazer deploy
Push (ou merge) em `main` → Vercel builda e publica automaticamente. Sem pipeline de CI rodando lint/typecheck/testes antes — rodar `npm run lint`, `npx tsc --noEmit` (ou `npm run typecheck`) e `npm run build` **localmente antes de commitar** é a única rede de segurança.

---

## 9. Segurança

- **RLS policies:** todo acesso a dado sensível passa por Row Level Security, nunca por checagem só no client. Padrão universal pro admin: `using (public.is_admin())` (função `security definer`, ver [§2.2](#22-padrão-de-autenticação)). Padrão pro aluno: comparação direta de `aluno_id = auth.uid()` ou uma função helper `security definer` (ex.: `aluno_acessa_aula(aula_id)`) quando a regra depende de um join (matrícula → turma → curso → aula).
- **Criptografia de credenciais:** ver [§2.6](#26-padrão-de-criptografia-gateways_encryption_key) — AES-256-GCM, chave só em env var, nunca no banco.
- **Proteção de rotas:** `requireRole()`/`requireEmpresa()` em toda `page.tsx` de área protegida **e** em toda Server Action, mesmo com o layout pai já protegendo (Partial Rendering do Next não re-executa o layout em toda navegação — ver [§2.2](#22-padrão-de-autenticação)).
- **Variáveis de ambiente sensíveis:** nunca commitar `.env*` (exceto `.env.example`); `SUPABASE_SECRET_KEY`, `GATEWAYS_ENCRYPTION_KEY`, `ASAAS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY` nunca chegam ao client (sem prefixo `NEXT_PUBLIC_`).
- **Webhooks de entrada:** todos exigem um header/token de autenticação próprio do provedor (`ASAAS_WEBHOOK_TOKEN`, etc.) — nunca aceitos "de graça" só pela URL.
- **HTML injetado (Telegram, e-mail):** todo valor interpolado numa mensagem com `parse_mode`/corpo HTML passa por escaping explícito antes.

---

## 10. Troubleshooting

### 10.1 GRANT permissions (erro 42501 — `permission denied for table`)
RLS habilitada não é suficiente: o Postgres também checa `GRANT` de tabela/coluna pro role (`authenticated` ou `service_role`) **antes** de sequer avaliar a policy. Uma tabela nova sem `grant select/insert/update/delete` explícito falha com `42501` mesmo com a policy certa. Caso real documentado: `20260901100000_fix_grant_whatsapp_config_id.sql` (faltava grant da coluna `id` de `whatsapp_config`). **Correção:** sempre incluir os `grant`s explícitos na própria migration que cria a tabela (ver [§2.4](#24-padrão-de-migrations-sql)); se o erro já está em produção, uma migration de fix separada como a citada acima resolve sem precisar recriar a tabela.

### 10.2 "JWT... failed verification" em página pública
Sintoma: uma rota **pública** (sem login) falha ao carregar dado do Supabase com esse erro. Causa: o visitante tem um cookie de sessão inválido/expirado no navegador (ficou logado como admin/aluno/empresa antes, no mesmo navegador) — o client autenticado normal (`createClient()`) tenta validar esse JWT stale e falha, mesmo a página não exigindo login nenhum. **Correção:** páginas e Server Actions genuinamente públicas (ex.: `/campanha/[slug]`, `/agendar/[slug]`) devem usar `createAdminClient()` (`service_role`, nunca depende de cookie) — documentado em `src/lib/campanha-paginas/campanha-paginas.ts`. Cuidado: isso bypassa RLS, então o filtro de "só retorna o que deveria ser público" (ex.: `.eq("status", "ativa")`) precisa estar explícito na própria query.

### 10.3 Tabs desmontando DOM (campo de formulário "sumindo" do FormData)
Sintoma: um form dividido em abas (`Tabs` do Base UI) salva certo quando o usuário clica "Salvar" na mesma aba de um campo, mas "esquece" esse campo quando salva a partir de outra aba. Causa: `TabsContent`/`TabsPanel` do Base UI **desmonta de verdade** (`keepMounted` é `false` por padrão) o conteúdo de abas não-ativas — qualquer `<input name="...">` fora da aba atual está fora do DOM e não é enviado no `FormData` nativo do submit. **Correção:** documentada em `src/components/admin/campanha-editor.tsx` — nunca confiar no `FormData` nativo pra um form em abas; sincronizar todo campo manualmente a partir do estado React pra dentro do `FormData` no `handleSubmit`, mesmo campos que "sempre pareceram funcionar" nos testes (só falham quando o Salvar acontece numa aba diferente da do campo).

### 10.4 Cache stale do Turbopack/`.next`
Sintoma: `npm run dev` já rodando continua servindo uma versão desatualizada da árvore de rotas depois que arquivos são criados/movidos (ex.: uma pasta nova em `[param]/page.tsx`) — geralmente aparece como 404 numa rota que existe de verdade e está correta. **Diagnóstico:** testar a mesma URL sem autenticação; um *redirect* (302/307) em vez de 404 puro indica que o Next reconhece a rota (descarta bug de lógica). Em build de produção (`npm run build`), o sintoma equivalente é `tsc`/build referenciando um módulo de rota que não existe mais (`Cannot find module '.../page.js'`) — sinal de `.next/types` desatualizado depois de uma mudança estrutural de rotas ou merge de branch. **Correção:** `rm -rf .next` e rodar de novo (não precisa reinstalar `node_modules`). Ver também [§10.6](#106-deploy-na-vercel-falha-por-cache-de-build-mesmo-com-o-build-local-passando).

### 10.5 Redis desconectado na Evolution API
A Evolution API (servidor externo de WhatsApp, ver [§7.4](#74-evolution-api-whatsapp)) depende de Redis na própria infraestrutura dela pra gerenciar sessão/estado das instâncias — isso é **externo a este repositório**, não há código Redis neste projeto. Sintoma do lado de cá: `statusInstancia()`/`enviarWhatsapp()` (`src/lib/whatsapp/evolution.ts`) passam a retornar erro HTTP ou timeout mesmo com a API key certa. **Diagnóstico:** checar diretamente a saúde do servidor Evolution API (fora deste código) antes de suspeitar de bug aqui — os `console.error` já adicionados nesses clientes (com a API key truncada) ajudam a confirmar que a requisição saiu certa daqui e o problema é do outro lado.

### 10.6 Deploy na Vercel falha por cache de build (mesmo com o build local passando)
Sintoma real já visto: erro `figtree_<hash>.module.css module-not-found` no build da Vercel, com o código de `next/font` correto e `npm run build` passando localmente (inclusive com `.next` local intacto, sem apagar). Causa: o nome do módulo CSS gerado por `next/font` é um hash da config inteira passada pro loader (`Figtree({...})`) — o cache de build da Vercel guardou uma referência a um hash antigo que não existe mais no grafo do build atual. **Correção mais confiável que um commit vazio sozinho:** mudar algo real na config da fonte (ex.: adicionar `display: "swap"`, que também é boa prática) — isso gera um hash novo, que não pode colidir com a entrada stale do cache. Ver `src/app/layout.tsx` e o comentário em `next.config.ts`.

### 10.7 Merge conflitante entre `main` e `develop`
Sintoma visto mais de uma vez nesta sessão: um merge deixou marcadores `<<<<<<<`/`=======`/`>>>>>>>` sem resolver dentro de arquivos `.tsx`/`.ts`, quebrando `tsc`/build (`error TS1185: Merge conflict marker encountered`). **Diagnóstico:** `grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" src/` acha qualquer marcador esquecido. **Correção:** resolver mantendo a versão mais recente/correta de cada lado (checar `git log` de cada branch pra saber qual lado é mais novo), nunca assumir automaticamente que um lado "ganha". Antes de mesclar, `git merge-base --is-ancestor main develop` confirma se dá pra esperar um fast-forward limpo (sem conflito possível).
