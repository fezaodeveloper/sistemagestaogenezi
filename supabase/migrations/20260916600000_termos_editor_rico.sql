-- 2 melhorias independentes, num arquivo único por pedido explícito da
-- tarefa: editor rico pros termos (Melhoria 2) e suporte a vídeo
-- embed/Vimeo nos treinamentos (Melhoria 4).
--
-- Renomeada de 20260910100000_termos_editor_rico.sql (nome pedido
-- originalmente) para 20260916600000: aquele timestamp já pertence a um
-- arquivo existente e não relacionado (20260910100000_calendario_academico.sql)
-- — reaproveitar o nome sobrescreveria uma migration antiga.
--
-- Mostrar SQL — NÃO aplicar.

-- ===== PARTE 1: editor rico nos termos (Melhoria 2) =====

ALTER TABLE public.termos
  ADD COLUMN IF NOT EXISTS conteudo_json jsonb,
  ADD COLUMN IF NOT EXISTS cor_texto text DEFAULT '#000000';

GRANT UPDATE (conteudo_json, cor_texto) ON public.termos TO authenticated;
GRANT INSERT (conteudo_json, cor_texto) ON public.termos TO authenticated;

-- ===== PARTE 2: vídeo embed/Vimeo nos treinamentos (Melhoria 4) =====

ALTER TABLE public.treinamentos
  ADD COLUMN IF NOT EXISTS tipo_video text DEFAULT 'youtube'
    CHECK (tipo_video IN ('youtube','vimeo','embed')),
  ADD COLUMN IF NOT EXISTS embed_codigo text;

GRANT UPDATE (tipo_video, embed_codigo) ON public.treinamentos TO authenticated;
GRANT INSERT (tipo_video, embed_codigo) ON public.treinamentos TO authenticated;
