-- Referência da nota fiscal emitida pela Spedy pra cada parcela paga: o id (UUID) da
-- nota na Spedy. Vazio = ainda não emitida. O número da nota só existe depois que a
-- prefeitura autoriza (a emissão é assíncrona), então é consultado na Spedy sob
-- demanda em vez de guardado aqui.
--
-- Escrita pelo servidor com o client admin (service_role, que já tem grant amplo em
-- parcelas) — por isso não há grant de update pra authenticated.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.parcelas
  add column if not exists spedy_nota_id text;

comment on column public.parcelas.spedy_nota_id is
  'ID da NFS-e na Spedy (service-invoices). Null = nota ainda não emitida pela Spedy.';
