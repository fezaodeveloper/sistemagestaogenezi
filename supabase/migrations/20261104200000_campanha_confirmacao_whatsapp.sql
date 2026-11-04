-- TAREFA campanha — PARTE 7: confirmação automática de inscrição em campanha por WhatsApp.
--
-- PERGUNTA DE FATO (investigação): a Server Action de submissão da campanha pública
-- (enviarRespostaCampanha, src/app/campanha/[slug]/actions.ts) NUNCA enviou WhatsApp de verdade —
-- só tinha um `console.log` comentado como "Stub — Evolution API virá depois". Mesmo achado já
-- documentado em 20261031600000_agendamento_confirmacao_whatsapp.sql pra agendamentos.
--
-- Mesmo padrão dessa migration de agendamento: (1) novo valor do enum mensagem_whatsapp_tipo
-- (auditoria em mensagens_enviadas), (2) novo toggle wz_campanha_confirmacao em configuracoes.
--
-- (3) Também estende o catálogo de public.whatsapp_templates (CHECK constraint por lista fixa de
-- ids) com 'campanha_confirmacao', pra o template ficar editável em Configurações > WhatsApp >
-- Templates — sem isso, o editor mostraria o template (lido do catálogo em código,
-- src/lib/whatsapp/templates.ts) mas salvar uma edição falharia na constraint.
--
-- ACHADO COLATERAL (fora do escopo original, corrigido de brinde): 'agendamento_confirmacao' já
-- está no catálogo em código (src/lib/whatsapp/templates.ts) e é usado de verdade
-- (src/lib/whatsapp/eventos.ts), mas NUNCA tinha sido adicionado a esta constraint (a migration
-- 20261031600000 que o introduziu só tocou o enum e configuracoes) — até agora, se um admin
-- tentasse editar e salvar esse template específico em Configurações > WhatsApp > Templates, o
-- UPSERT falharia por violar a constraint. Como esta migration já precisa reescrever a lista
-- inteira (DROP + ADD CONSTRAINT) pra incluir 'campanha_confirmacao', incluir o id que faltava
-- custou zero linhas extras — por isso vai junto, em vez de deixar o bug conhecido para depois.

alter type public.mensagem_whatsapp_tipo add value if not exists 'campanha_confirmacao';

alter table public.configuracoes
  add column if not exists wz_campanha_confirmacao boolean not null default true;

grant update (wz_campanha_confirmacao) on public.configuracoes to authenticated;

alter table public.whatsapp_templates drop constraint if exists whatsapp_templates_id_check;
alter table public.whatsapp_templates add constraint whatsapp_templates_id_check check (
  id in (
    'matricula_criada', 'lembrete_aula', 'falta_aula', 'recontato_lead',
    'agendamento_confirmacao', 'agendamento_lembrete', 'agendamento_cancelado', 'agendamento_falta',
    'cobranca_gerada', 'cobranca_atrasada_d1', 'cobranca_atrasada_d3',
    'cobranca_atrasada_d7', 'cobranca_atrasada_d15', 'lead_followup',
    'campanha_confirmacao'
  )
);

insert into public.whatsapp_templates (id, nome, mensagem, variaveis) values
  (
    'campanha_confirmacao', 'Confirmação de inscrição em campanha',
    'Olá {nome}! ✅ Recebemos sua inscrição na campanha *{campanha}*!\n\nEm breve entraremos em contato. 😊\n\n*Gênezi Educação Profissional*',
    array['nome', 'campanha', 'pontuacao', 'pontuacao_max', 'percentual']
  )
on conflict (id) do nothing;

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
