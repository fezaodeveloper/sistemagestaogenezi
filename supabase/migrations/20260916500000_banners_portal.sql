-- Slideshow de ofertas no portal do aluno (Melhoria 3): adiciona 'portal'
-- como terceiro valor válido de login_banners.tipo, ao lado de 'admin' e
-- 'aluno' já existentes.
--
-- Renomeada de 20260909100000_banners_portal.sql (nome pedido originalmente)
-- para 20260916500000: aquele timestamp já pertence a um arquivo existente
-- e não relacionado (20260909100000_turmas_campos_expandidos.sql) —
-- reaproveitar o nome sobrescreveria uma migration antiga.
--
-- Mostrada para revisão — NÃO aplicar ainda.

alter table public.login_banners
  drop constraint if exists login_banners_tipo_check;
alter table public.login_banners
  add constraint login_banners_tipo_check
    check (tipo in ('admin','aluno','portal'));

grant update (tipo) on public.login_banners to authenticated;
