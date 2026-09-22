-- GênZap — conexão com a Evolution API (QR code, status, anti-banimento) em
-- Configurações > WhatsApp.
--
-- ===== O QUE JÁ EXISTIA (verificado antes de escrever — buscas por "WhatsApp"/"stub"/
-- "evolution" em todo o código, pedidas explicitamente na tarefa) =====
--
-- A tabela `whatsapp_config` JÁ EXISTE (20260831100000_create_mensagens_whatsapp.sql), como
-- singleton `id boolean primary key default true` (mesmo padrão de `configuracoes`), com
-- `evolution_api_url`, `evolution_instance_name`, `evolution_api_key`, `ativo` e 4 colunas de
-- template (`template_matricula_criada` etc). Ela já alimenta um sistema de envio REAL e
-- funcionando (`src/lib/mensagens/`): 4 eventos (matrícula criada, lembrete de aula, falta,
-- recontato de lead) já mandam WhatsApp de verdade via Evolution API `POST /message/sendText`,
-- com log em `mensagens_enviadas` e template editável em Configurações > Mensagens > Configuração.
--
-- A tarefa pede uma tabela NOVA `whatsapp_config` com PK `uuid` fixo — impossível (colidiria de
-- nome com a existente) e, pior, recriar a tabela do zero DERRUBARIA os 4 eventos reais acima.
-- Por isso esta migration ALTERA a tabela existente (mesma PK boolean, mesmas colunas de conexão
-- reaproveitadas) em vez de criar uma nova. As colunas pedidas que ainda não existiam (status da
-- conexão, número conectado, delays anti-banimento) entram como ALTER TABLE ADD COLUMN.
--
-- Divergências de nome (mantendo os nomes já em uso, por causa do "não duplicar/não quebrar"):
--   evolution_url        -> reaproveita evolution_api_url (já existe)
--   evolution_instancia   -> reaproveita evolution_instance_name (já existe; ganha default 'genezi')
--   evolution_api_key     -> já existe (mas era guardada em TEXTO PURO — ver abaixo)
--
-- ===== BUG DE SEGURANÇA ENCONTRADO E CORRIGIDO: evolution_api_key em texto puro =====
-- Ao contrário de TODA outra integração do projeto (IntegraX, e-mail, Spedy, gateways — todas
-- via src/lib/gateways/crypto.ts, AES-256-GCM), `evolution_api_key` nunca foi criptografada.
-- `authenticated` não tem SELECT nessa coluna (mitiga parcialmente), mas o valor ainda ficava em
-- claro no banco, lido por `service_role` sem `descriptografar()`. Esta migration não altera a
-- coluna (dado existente não é migrado automaticamente — não dá pra criptografar em SQL puro sem
-- a chave da aplicação), mas o código (ver arquivos alterados) passa a CRIPTOGRAFAR toda gravação
-- nova. `descriptografar()` já trata valor sem o prefixo "enc:v1:" como texto legado e devolve
-- sem alterar — uma chave salva antes desta mudança continua funcionando sem re-cadastro.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.whatsapp_config
  add column if not exists status text not null default 'desconectado'
    check (status in ('desconectado', 'aguardando_qr', 'conectado')),
  add column if not exists numero_conectado text,
  -- Delay mínimo/máximo (segundos) entre envios em sequência — anti-banimento.
  add column if not exists delay_min_segundos integer not null default 3
    check (delay_min_segundos between 1 and 10),
  add column if not exists delay_max_segundos integer not null default 8
    check (delay_max_segundos between 1 and 30);

alter table public.whatsapp_config
  add constraint whatsapp_config_delay_check check (delay_max_segundos >= delay_min_segundos);

-- 'genezi' é o nome de instância padrão pedido — só como DEFAULT de coluna (não sobrescreve nome
-- já configurado); preenche a linha semeada em 2026-08-31 caso ainda esteja nula.
alter table public.whatsapp_config alter column evolution_instance_name set default 'genezi';
update public.whatsapp_config set evolution_instance_name = 'genezi' where evolution_instance_name is null;

-- RLS já é "só admin" pra toda a tabela (policies existentes, sem mudança). Grants column-level
-- adicionais pras colunas novas — authenticated NUNCA escreve status/numero_conectado
-- diretamente (só reflete o que a Evolution API realmente respondeu): sem grant de UPDATE nessas
-- duas, só SELECT. Quem escreve é sempre o client admin (service_role, que já tem grant amplo na
-- tabela inteira desde a migration original), dentro das Route Handlers de conectar/status.
grant select (status, numero_conectado, delay_min_segundos, delay_max_segundos)
  on public.whatsapp_config to authenticated;
grant update (delay_min_segundos, delay_max_segundos) on public.whatsapp_config to authenticated;
