-- Acesso Remoto (TAREFA 1) — credenciais de acesso remoto aos computadores
-- da escola. Mostrar SQL — NÃO aplicar.

CREATE TABLE public.acesso_remoto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_pc text NOT NULL,
  login text NOT NULL,
  senha text NOT NULL,
  ip text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acesso_remoto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam acesso remoto"
  ON public.acesso_remoto FOR ALL USING (public.is_admin());

GRANT SELECT ON public.acesso_remoto TO authenticated;
GRANT INSERT (nome_pc, login, senha, ip, observacoes, ativo)
  ON public.acesso_remoto TO authenticated;
GRANT UPDATE (nome_pc, login, senha, ip, observacoes, ativo)
  ON public.acesso_remoto TO authenticated;
GRANT DELETE ON public.acesso_remoto TO authenticated;

CREATE TRIGGER on_acesso_remoto_updated
  BEFORE UPDATE ON public.acesso_remoto
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
