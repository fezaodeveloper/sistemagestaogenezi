-- Melhorias de layout no template do certificado: caixa de texto com
-- margens configuráveis (frente/verso) e posição/tamanho da assinatura.
-- Fonte do texto (tamanho) não entra aqui — vai dentro do jsonb que já
-- existe (texto_frente/texto_verso), sem coluna nova.

alter table public.certificado_template
  add column texto_frente_margens jsonb not null default
    '{"superior":20,"inferior":20,"esquerda":10,"direita":10}'::jsonb,
  add column texto_verso_margens jsonb not null default
    '{"superior":20,"inferior":20,"esquerda":10,"direita":10}'::jsonb;

-- x/y em % da página, origem no topo-esquerda (0% = topo/esquerda da
-- página, 100% = base/direita) — mesma convenção intuitiva de CSS
-- top/left, mais fácil pro admin preencher do que "de baixo pra cima".
-- Largura em px (tamanho absoluto de exibição, altura calculada
-- preservando a proporção da imagem, igual já fazemos com o logo).
alter table public.certificado_template
  add column assinatura_x_percentual integer not null default 50
    check (assinatura_x_percentual between 0 and 100),
  add column assinatura_y_percentual integer not null default 90
    check (assinatura_y_percentual between 0 and 100),
  add column assinatura_largura_px integer not null default 200
    check (assinatura_largura_px > 0);

grant update (
  texto_frente_margens, texto_verso_margens,
  assinatura_x_percentual, assinatura_y_percentual, assinatura_largura_px
) on public.certificado_template to authenticated;
