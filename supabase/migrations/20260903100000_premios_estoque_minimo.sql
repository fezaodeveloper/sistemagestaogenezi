-- Estoque mínimo configurável por prêmio, usado pro alerta de estoque
-- baixo (resumo diário + notificação imediata ao editar — ver
-- src/lib/automacoes/handlers/resumo-diario.ts e
-- src/app/admin/premios/actions.ts).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

ALTER TABLE public.premios
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 5;
GRANT UPDATE (estoque_minimo) ON public.premios TO authenticated;

-- Grant adicional (fora do texto original da tarefa): public.premios usa
-- grants coluna a coluna, sem blanket grant — createPremio() faz um INSERT
-- que agora inclui estoque_minimo (o formulário de criação também ganhou
-- o campo, TAREFA 1B), então sem esse grant o cadastro de um prêmio novo
-- quebraria com "permission denied for table premios". Mesmo padrão já
-- visto em contrato_template e matriculas.taxa_matricula* nas duas últimas
-- tarefas.
GRANT INSERT (estoque_minimo) ON public.premios TO authenticated;
