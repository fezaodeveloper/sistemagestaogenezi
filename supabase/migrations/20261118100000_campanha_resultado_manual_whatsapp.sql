-- NÃO APLICADA

-- TAREFA campanha — melhorias (FUNCIONALIDADE 4/5): envio manual do resultado por WhatsApp,
-- individual ou em massa (aprovados/reprovados), disparado por clique do admin em
-- /admin/comercial/paginas-campanha/[id]/respostas (src/lib/whatsapp/eventos.ts::
-- enviarResultadoCampanhaWhatsapp / enviarResultadoCampanhaWhatsappEmMassa).
--
-- Mesmo padrão já usado em 20261104200000_campanha_confirmacao_whatsapp.sql e
-- 20261031600000_agendamento_confirmacao_whatsapp.sql: novo valor no enum
-- mensagem_whatsapp_tipo, só pra auditoria em mensagens_enviadas — este envio é ad hoc (mensagem
-- fixa em código, não passa pelo catálogo editável de whatsapp_templates), então não precisa de
-- entrada em whatsapp_templates nem de toggle em configuracoes (é sempre uma ação manual e
-- explícita do admin, não um evento automático que possa ser desligado).

alter type public.mensagem_whatsapp_tipo add value if not exists 'campanha_resultado_manual';
