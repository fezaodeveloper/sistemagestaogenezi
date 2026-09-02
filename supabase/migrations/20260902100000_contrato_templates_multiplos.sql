-- A tabela contrato_template atual é singleton (1 registro). Passa a
-- suportar múltiplos templates, um por tipo de curso (presencial/ead/
-- híbrido) — migra o conteúdo existente (presencial) e cria os outros dois
-- a partir dele.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

ALTER TABLE public.contrato_template
  ADD COLUMN IF NOT EXISTS tipo_curso text NOT NULL DEFAULT 'presencial'
    CHECK (tipo_curso IN ('presencial','ead','hibrido')),
  ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Contrato Padrão';

-- Remover o índice singleton (não faz mais sentido: agora convivem até 3
-- registros, um por tipo_curso).
DROP INDEX IF EXISTS contrato_template_singleton;

-- Criar índice único por tipo de curso
CREATE UNIQUE INDEX contrato_template_tipo_curso_idx
  ON public.contrato_template (tipo_curso);

-- Inserir templates para EAD e Híbrido a partir do conteúdo do presencial
-- existente (Presencial já existe como o template atual).
INSERT INTO public.contrato_template (tipo_curso, nome, conteudo, cor_texto)
SELECT 'ead', 'Contrato EAD', conteudo, cor_texto
FROM public.contrato_template WHERE tipo_curso = 'presencial'
ON CONFLICT (tipo_curso) DO NOTHING;

INSERT INTO public.contrato_template (tipo_curso, nome, conteudo, cor_texto)
SELECT 'hibrido', 'Contrato Híbrido', conteudo, cor_texto
FROM public.contrato_template WHERE tipo_curso = 'presencial'
ON CONFLICT (tipo_curso) DO NOTHING;

GRANT UPDATE (tipo_curso, nome) ON public.contrato_template TO authenticated;

-- Grant adicional (fora do texto original da tarefa): o INSERT grant de
-- 20260831100000_contrato_matricula.sql só cobre (conteudo, conteudo_texto,
-- cor_texto, created_by) — sem tipo_curso/nome nessa lista, o Postgres
-- rejeita o insert de fallback que a página /admin/contrato faz quando um
-- dos 3 tipos ainda não tem template (ver "cria o que ainda não existir"
-- em src/app/admin/contrato/page.tsx, que grava tipo_curso e nome
-- explicitamente). Sem este grant, esse fallback quebra com "permission
-- denied for table contrato_template" pros tipos ead/hibrido.
GRANT INSERT (tipo_curso, nome) ON public.contrato_template TO authenticated;
