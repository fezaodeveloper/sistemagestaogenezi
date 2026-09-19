-- Páginas de campanha: cards de destaque no cabeçalho + rename do tipo de
-- questão "checkbox" (Sim único) para "checkbox_unico".
--
-- A etapa de confirmação e o checkbox com várias opções vivem dentro do jsonb
-- `etapas` (e as respostas em `campanha_respostas.respostas`, jsonb, que já
-- aceita array) — não precisam de coluna nova.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== 1. Cards de destaque =====
-- Ex.: [{"valor": "50%", "label": "DESCONTO"}, {"valor": "6 meses", "label": "DE CURSO"}]
-- Até 3 (limite validado no Zod; aqui só a forma: array).
alter table public.campanha_paginas
  add column if not exists cards_destaque jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cards_destaque) = 'array');

grant update (cards_destaque) on public.campanha_paginas to authenticated;

-- ===== 2. Checkbox "Sim" único: tipo "checkbox" -> "checkbox_unico" =====
-- Até aqui "checkbox" era um único "Sim" (valor booleano). Agora "checkbox" é
-- um grupo de opções (valor = array de letras) e o antigo virou
-- "checkbox_unico". Renomeia nas questões já cadastradas pra nada mudar de
-- comportamento. (O código também trata "checkbox" sem opções como checkbox
-- único, então a página não quebra se o deploy sair antes desta migration.)
update public.campanha_paginas
set etapas = (
  select coalesce(jsonb_agg(
    case
      when jsonb_typeof(etapa -> 'questoes') = 'array' then
        jsonb_set(
          etapa,
          '{questoes}',
          (
            select coalesce(jsonb_agg(
              case when questao ->> 'tipo' = 'checkbox'
                then jsonb_set(questao, '{tipo}', '"checkbox_unico"')
                else questao
              end
            ), '[]'::jsonb)
            from jsonb_array_elements(etapa -> 'questoes') as questao
          )
        )
      else etapa
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(etapas) as etapa
)
where etapas @> '[{"questoes": [{"tipo": "checkbox"}]}]'::jsonb;
