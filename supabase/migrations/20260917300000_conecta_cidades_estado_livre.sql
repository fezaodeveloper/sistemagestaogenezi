-- Gênezi Conecta — permitir cadastrar cidades de qualquer estado (não só
-- SE/AL) em conecta_cidades, pra suportar expansão futura da região
-- atendida sem precisar de migration nova a cada estado novo.
--
-- Sem isso, a TAREFA 2 (campo "Estado" livre no dialog de adicionar
-- cidade) não funcionaria de verdade: um INSERT com estado = 'PE', por
-- exemplo, violaria o CHECK (estado IN ('SE','AL')) da migration
-- 20260917200000_conecta_cidades.sql antes mesmo de chegar na aplicação.
--
-- Mostrar SQL — NÃO aplicar.

alter table public.conecta_cidades drop constraint conecta_cidades_estado_check;
alter table public.conecta_cidades
  add constraint conecta_cidades_estado_check check (estado ~ '^[A-Z]{2}$');
