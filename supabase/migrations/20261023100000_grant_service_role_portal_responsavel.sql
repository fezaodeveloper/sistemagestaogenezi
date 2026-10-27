-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- Redesign do portal do responsável (rota pública, sem sessão — usa
-- createAdminClient()/service_role em todas as queries, ver CLAUDE.md) passou a precisar ler
-- badges/badges_conquistados (seção Conquistas) e aulas_concluidas (seção Curso/progresso por
-- módulo). As três tabelas só tinham grant de select para "authenticated" — confirmado
-- empiricamente com o client admin: "permission denied for table badges" (42501) e mesmo erro
-- para badges_conquistados e aulas_concluidas. Mesma classe de pendência já documentada no
-- CLAUDE.md para turmas/cursos/matriculas antes da Fase 10 (certificados).
--
-- Só select: o portal do responsável nunca escreve nessas tabelas.

grant select on public.badges to service_role;
grant select on public.badges_conquistados to service_role;
grant select on public.aulas_concluidas to service_role;
