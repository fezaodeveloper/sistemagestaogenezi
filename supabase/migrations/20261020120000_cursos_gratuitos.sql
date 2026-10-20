-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Suporte a cursos gratuitos no wizard de matrícula: o admin marca um curso como gratuito
-- (checkbox "Curso Gratuito" na Etapa 3 do wizard busca esses cursos via getCursosGratuitos()).
-- Mesmo padrão aditivo de 20260908100000_cursos_valor.sql — só ADD COLUMN + grants extras,
-- nada do que já existe em "cursos" é recriado.

alter table public.cursos
  add column if not exists gratuito boolean not null default false;

-- Aditivo aos grants da Fase 1 (create_cursos) — select já é concedido na tabela inteira (sem
-- restrição de coluna), então já cobre a leitura da coluna nova automaticamente.
grant insert (gratuito) on public.cursos to authenticated;
grant update (gratuito) on public.cursos to authenticated;
