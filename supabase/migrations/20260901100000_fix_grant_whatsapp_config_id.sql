-- Bug encontrado testando /admin/mensagens/configuracao: consultar
-- whatsapp_config filtrando por id (.eq("id", true), padrão singleton)
-- retornava "permission denied for table whatsapp_config" (42501) pro
-- client autenticado normal, mesmo com select liberado nas colunas
-- devolvidas — grants de coluna cobrem toda coluna referenciada na
-- query inteira (select E where/eq), não só o que é devolvido, e "id"
-- tinha ficado fora da lista original.
grant select (id) on public.whatsapp_config to authenticated;
