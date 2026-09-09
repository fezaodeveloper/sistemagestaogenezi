-- Link de destino e intervalo de troca configuráveis por banner (Melhoria 2
-- do portal do aluno). Mostrar SQL — NÃO aplicar.

ALTER TABLE public.login_banners
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS intervalo_segundos integer DEFAULT 6;

GRANT UPDATE (link_url, intervalo_segundos)
  ON public.login_banners TO authenticated;
