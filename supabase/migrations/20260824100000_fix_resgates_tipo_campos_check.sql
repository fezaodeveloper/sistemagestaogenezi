-- Corrige bug encontrado ao testar exclusão de curso/prêmio já
-- resgatado: a constraint original exigia curso_id/premio_id not null
-- justamente na coluna que "on delete set null" zera quando o
-- curso/prêmio é excluído, tornando IMPOSSÍVEL excluir qualquer curso
-- bônus ou prêmio que já tenha sido resgatado uma vez sequer.
-- item_nome já carrega o nome congelado no momento do resgate — a
-- constraint só precisa continuar garantindo a exclusividade mútua
-- entre os tipos (uma linha curso_bonus nunca tem premio_id, e
-- vice-versa), sem mais exigir que a própria referência do tipo seja
-- obrigatoriamente não-nula.

alter table public.resgates drop constraint resgates_tipo_campos_check;

alter table public.resgates add constraint resgates_tipo_campos_check check (
  (tipo = 'curso_bonus' and premio_id is null and status = 'concluido')
  or
  (tipo = 'premio_fisico' and curso_id is null and status in ('pendente', 'entregue'))
);
