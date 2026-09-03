-- Nota fiscal por parcela paga — checkbox "NF emitida" + anexo opcional
-- (PDF/XML/imagem) no bucket privado notas-fiscais.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- Bucket para notas fiscais
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false);

CREATE POLICY "Admins gerenciam notas fiscais"
  ON storage.objects FOR ALL
  USING (bucket_id = 'notas-fiscais' AND public.is_admin())
  WITH CHECK (bucket_id = 'notas-fiscais' AND public.is_admin());

ALTER TABLE public.parcelas
  ADD COLUMN IF NOT EXISTS nota_fiscal_emitida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nota_fiscal_url text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_path text;

GRANT UPDATE (nota_fiscal_emitida, nota_fiscal_url, nota_fiscal_path)
  ON public.parcelas TO authenticated;
