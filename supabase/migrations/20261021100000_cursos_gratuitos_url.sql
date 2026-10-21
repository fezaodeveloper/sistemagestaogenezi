-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Página dedicada de gestão de Cursos Gratuitos (/admin/cursos-gratuitos): cada curso gratuito
-- é hospedado numa plataforma externa, não dentro desta plataforma — precisa de uma URL de
-- redirecionamento. Mesmo padrão aditivo de 20261020120000_cursos_gratuitos.sql (só ADD COLUMN +
-- grants extras).

alter table public.cursos
  add column if not exists url_plataforma_externa text;

comment on column public.cursos.url_plataforma_externa is
  'URL da plataforma externa onde o curso gratuito é realizado';

grant insert (url_plataforma_externa) on public.cursos to authenticated;
grant update (url_plataforma_externa) on public.cursos to authenticated;
