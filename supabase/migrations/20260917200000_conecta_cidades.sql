-- Gênezi Conecta — cidades aprovadas pra cadastro de vagas (restringe
-- empresas a SE e AL, região de Propriá/SE).
--
-- Mostrar SQL — NÃO aplicar.

CREATE TABLE public.conecta_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('SE','AL')),
  ativa boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, estado)
);

ALTER TABLE public.conecta_cidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam cidades"
  ON public.conecta_cidades FOR ALL USING (public.is_admin());
CREATE POLICY "Todos podem ver cidades ativas"
  ON public.conecta_cidades FOR SELECT USING (ativa = true);

GRANT SELECT ON public.conecta_cidades TO authenticated;
-- Adicionado além do pedido original (só GRANT SELECT pra authenticated):
-- a policy "Admins gerenciam cidades" (FOR ALL) libera insert/update/delete
-- via RLS, mas sem o GRANT correspondente o Postgres bloqueia antes de
-- avaliar a policy — as Server Actions de /admin/conecta/cidades rodam
-- pelo client autenticado normal (não pelo client admin/service_role),
-- mesmo padrão do resto do CRUD admin deste projeto.
GRANT INSERT, UPDATE, DELETE ON public.conecta_cidades TO authenticated;
GRANT SELECT ON public.conecta_cidades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conecta_cidades TO service_role;

-- Seed: cidades iniciais (raio ~30km de Propriá/SE)
INSERT INTO public.conecta_cidades (nome, estado, ordem) VALUES
-- Sergipe
('Propriá', 'SE', 1),
('Neópolis', 'SE', 2),
('Santana do São Francisco', 'SE', 3),
('Amparo do São Francisco', 'SE', 4),
('Cedro de São João', 'SE', 5),
('Telha', 'SE', 6),
('Graccho Cardoso', 'SE', 7),
('Canhoba', 'SE', 8),
('Japoatã', 'SE', 9),
-- Alagoas
('Porto Real do Colégio', 'AL', 10),
('São Brás', 'AL', 11),
('Pão de Açúcar', 'AL', 12),
('Traipu', 'AL', 13),
('Belo Monte', 'AL', 14),
('Igreja Nova', 'AL', 15);
