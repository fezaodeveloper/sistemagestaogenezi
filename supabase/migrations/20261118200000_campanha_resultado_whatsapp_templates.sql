-- NÃO APLICADA

-- ITEM 1 (melhorias de campanha) — torna editáveis em Configurações > WhatsApp > Templates as
-- duas mensagens de "Enviar resultado" (aprovado/reprovado), hoje hardcoded em
-- montarMensagemResultadoCampanha (src/lib/whatsapp/eventos.ts). Mesmo padrão já usado em
-- 20261104200000_campanha_confirmacao_whatsapp.sql: estende a CHECK constraint de
-- whatsapp_templates.id (lista fixa) e insere a linha padrão (com ON CONFLICT DO NOTHING, pra
-- não sobrescrever se um admin já tiver editado antes desta migration ser aplicada).
--
-- E'...' (não '...' comum) nos dois inserts: string SQL comum não interpreta \n como quebra de
-- linha — mesmo bug já corrigido em 20261104200000 pro template campanha_confirmacao.

alter table public.whatsapp_templates drop constraint if exists whatsapp_templates_id_check;
alter table public.whatsapp_templates add constraint whatsapp_templates_id_check check (
  id in (
    'matricula_criada', 'lembrete_aula', 'falta_aula', 'recontato_lead',
    'agendamento_confirmacao', 'agendamento_lembrete', 'agendamento_cancelado', 'agendamento_falta',
    'cobranca_gerada', 'cobranca_atrasada_d1', 'cobranca_atrasada_d3',
    'cobranca_atrasada_d7', 'cobranca_atrasada_d15', 'lead_followup',
    'campanha_confirmacao', 'campanha_resultado_aprovado', 'campanha_resultado_reprovado'
  )
);

insert into public.whatsapp_templates (id, nome, mensagem, variaveis) values
  (
    'campanha_resultado_aprovado', 'Resultado de campanha — aprovado',
    E'Olá {nome}! 🎓 Parabéns! Você foi *aprovado(a)* na campanha {campanha}.\n\nAcesse seu resultado: {link_pdf}\n\n*Gênezi Educação Profissional*',
    array['nome', 'campanha', 'link_pdf']
  ),
  (
    'campanha_resultado_reprovado', 'Resultado de campanha — não aprovado',
    E'Olá {nome}! 🎓 Segue o resultado da sua participação na campanha {campanha}.\n\nAcesse seu resultado: {link_pdf}\n\nContinue estudando! *Gênezi Educação Profissional*',
    array['nome', 'campanha', 'link_pdf']
  )
on conflict (id) do nothing;
