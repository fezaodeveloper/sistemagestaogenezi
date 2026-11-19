-- NÃO APLICADA

-- MELHORIA 3 (templates de resultado separados por tipo de curso) — torna editáveis em
-- Configurações > WhatsApp > Templates as mensagens de resultado pra campanhas vinculadas a
-- curso gratuito (cursos.gratuito = true). Mesmo padrão já usado em
-- 20261118200000_campanha_resultado_whatsapp_templates.sql: estende a CHECK constraint de
-- whatsapp_templates.id e insere as linhas padrão (ON CONFLICT DO NOTHING).

alter table public.whatsapp_templates drop constraint if exists whatsapp_templates_id_check;
alter table public.whatsapp_templates add constraint whatsapp_templates_id_check check (
  id in (
    'matricula_criada', 'lembrete_aula', 'falta_aula', 'recontato_lead',
    'agendamento_confirmacao', 'agendamento_lembrete', 'agendamento_cancelado', 'agendamento_falta',
    'cobranca_gerada', 'cobranca_atrasada_d1', 'cobranca_atrasada_d3',
    'cobranca_atrasada_d7', 'cobranca_atrasada_d15', 'lead_followup',
    'campanha_confirmacao', 'campanha_resultado_aprovado', 'campanha_resultado_reprovado',
    'campanha_resultado_aprovado_gratuito', 'campanha_resultado_reprovado_gratuito'
  )
);

insert into public.whatsapp_templates (id, nome, mensagem, variaveis) values
  (
    'campanha_resultado_aprovado_gratuito', 'Resultado de campanha — aprovado (curso gratuito)',
    E'Olá {nome}! 🎓 Parabéns! Você foi *aprovado(a)* na campanha {campanha} e já pode acessar o curso gratuito.\n\nAcesse seu resultado: {link_pdf}\n\n*Gênezi Educação Profissional*',
    array['nome', 'campanha', 'link_pdf']
  ),
  (
    'campanha_resultado_reprovado_gratuito', 'Resultado de campanha — não aprovado (curso gratuito)',
    E'Olá {nome}! 🎓 Segue o resultado da sua participação na campanha {campanha}.\n\nAcesse seu resultado: {link_pdf}\n\nFique de olho nas próximas turmas do nosso curso gratuito! *Gênezi Educação Profissional*',
    array['nome', 'campanha', 'link_pdf']
  )
on conflict (id) do nothing;
