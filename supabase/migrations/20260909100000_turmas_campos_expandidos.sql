-- Turno, sala/local, professor, horário de término e observações da turma —
-- completam os dados exibidos na listagem e na tela de detalhes do módulo de
-- turmas (ver src/components/admin/turmas-table.tsx e turma-detalhes.tsx).
-- Mesmo padrão de GRANT por coluna já usado em 20260817100000_add_cadencia_turmas.sql
-- e 20260831100000_create_mensagens_whatsapp.sql (horario_aula).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.turmas
  add column if not exists turno text check (turno in ('manha', 'tarde', 'noite')),
  add column if not exists local_sala text,
  add column if not exists professor text,
  add column if not exists horario_fim text,
  add column if not exists observacoes text;

grant insert (turno, local_sala, professor, horario_fim, observacoes) on public.turmas to authenticated;
grant update (turno, local_sala, professor, horario_fim, observacoes) on public.turmas to authenticated;
