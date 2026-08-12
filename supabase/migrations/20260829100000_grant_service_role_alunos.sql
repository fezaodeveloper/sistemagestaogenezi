-- Bug encontrado em teste: emitirCertificado() (client admin/service_role)
-- passou a ler alunos.cpf pra variável {cpf} do certificado, mas
-- public.alunos nunca tinha recebido grant pra service_role (só
-- turmas/cursos/matriculas foram concedidos na Fase 10 original, quando
-- ainda não líamos CPF). Mesmo padrão das outras concessões.
grant select, insert, update, delete on public.alunos to service_role;
