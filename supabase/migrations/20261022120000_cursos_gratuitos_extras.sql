-- NÃO APLICADA — aplicar manualmente no SQL Editor

-- Campos extras pra página de gestão de Cursos Gratuitos (/admin/cursos-gratuitos): carga
-- horária (texto livre, ex. "40h") e foto (igual padrão de cursos.capa_url/capa_path, bucket
-- "cursos" já existente e já público — ver 20260825100000_add_capa_cursos.sql). Mesmo padrão
-- aditivo das demais colunas de public.cursos.

alter table public.cursos
  add column if not exists carga_horaria text,
  add column if not exists foto_url text,
  add column if not exists foto_path text;

comment on column public.cursos.carga_horaria is 'Ex: 40h, 20 horas, etc.';
comment on column public.cursos.foto_url is 'URL pública da foto do curso no Storage';
comment on column public.cursos.foto_path is 'Path interno no bucket "cursos" do Storage';

-- select já é concedido na tabela inteira (sem restrição de coluna, ver create_cursos) — só
-- insert/update por coluna específica precisam de grant novo.
grant insert (carga_horaria, foto_url, foto_path) on public.cursos to authenticated;
grant update (carga_horaria, foto_url, foto_path) on public.cursos to authenticated;
