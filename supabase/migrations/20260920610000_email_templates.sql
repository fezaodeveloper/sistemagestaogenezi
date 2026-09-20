-- Templates de e-mail editáveis pelo admin (Configurações > E-mail > Templates).
--
-- Um por tipo de e-mail do sistema. `variaveis` é a lista de placeholders que o
-- template aceita ({nome_cliente} etc.); só essas são substituídas ao enviar. Sintaxe
-- extra: {#se variavel} ... {/se} mostra o trecho só se a variável tiver valor.
--
-- A semente abaixo é o texto PADRÃO — o mesmo de src/lib/email/templates-padrao.ts
-- (gerada a partir dele; o botão "Restaurar padrão" da tela regrava esse conteúdo, e o
-- app usa o arquivo como reserva se esta tabela estiver indisponível). Sem
-- "created_by" (convenção CLAUDE.md): são linhas de referência semeadas por migration.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.email_templates (
  id text primary key
    check (id in ('acesso', 'cobranca', 'boas_vindas', 'agendamento', 'recuperacao_senha', 'lead_confirmacao')),
  nome text not null,
  assunto text not null,
  corpo_html text not null,
  variaveis text[] not null default '{}',
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger on_email_templates_updated
  before update on public.email_templates
  for each row execute function public.handle_updated_at();

alter table public.email_templates enable row level security;

create policy "Admins gerenciam templates de e-mail"
  on public.email_templates for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.email_templates to authenticated;
-- O envio roda em webhooks e formulários públicos, sem sessão (client admin).
grant select, insert, update, delete on public.email_templates to service_role;

insert into public.email_templates (id, nome, assunto, corpo_html, variaveis) values
('acesso', $tpl$Dados de acesso$tpl$, $tpl$Seu acesso ao portal do aluno — {nome_produto}$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Sua matrícula em <strong>{nome_produto}</strong> foi confirmada. Estes são os seus dados de acesso ao portal do aluno:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>E-mail:</strong> {email_cliente}<br>
      <strong>Senha:</strong> {senha}
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="{link_acesso}" style="display:inline-block;background:#06b6d4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar o portal →</a>
    </p>
    <p>Por segurança, altere a senha no seu primeiro acesso.</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'email_cliente', 'senha', 'nome_produto', 'link_acesso', 'nome_escola']::text[]),
('cobranca', $tpl$Cobrança gerada$tpl$, $tpl$Cobrança: {descricao} — vence em {vencimento}$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Geramos uma cobrança para você:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>{descricao}</strong><br>
      Valor: <strong>{valor}</strong><br>
      Vencimento: <strong>{vencimento}</strong>
    </p>
    {#se link_boleto}    <p style="text-align:center;margin:24px 0;">
      <a href="{link_boleto}" style="display:inline-block;background:#06b6d4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver boleto / fatura →</a>
    </p>{/se}
    {#se link_pix}<p>Prefere pagar por PIX? <a href="{link_pix}">Abra a fatura e escolha PIX</a>.</p>{/se}
    {#se codigo_pix}<p><strong>PIX copia e cola:</strong></p>
    <p style="background:#f1f5f9;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;">{codigo_pix}</p>{/se}
    <p>Se você já pagou, desconsidere este e-mail.</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'descricao', 'valor', 'vencimento', 'link_boleto', 'link_pix', 'codigo_pix', 'nome_escola']::text[]),
('boas_vindas', $tpl$Boas-vindas$tpl$, $tpl$Bem-vindo(a) à {nome_escola}!$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>É uma alegria ter você conosco na <strong>{nome_escola}</strong>. Sua matrícula foi realizada com sucesso.</p>
    <p>Em breve você receberá as próximas orientações. Qualquer dúvida, é só responder este e-mail ou falar com a nossa secretaria.</p>
    <p>Bons estudos!</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'nome_escola']::text[]),
('agendamento', $tpl$Confirmação de agendamento$tpl$, $tpl$Agendamento confirmado — {data} às {horario}$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Seu agendamento está confirmado:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>{nome_pagina}</strong><br>
      {dia_semana}, {data} às <strong>{horario}</strong>
    </p>
    <p>Precisando remarcar, entre em contato com a nossa secretaria. Esperamos você!</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'data', 'horario', 'dia_semana', 'nome_pagina', 'nome_escola']::text[]),
('recuperacao_senha', $tpl$Recuperação de senha$tpl$, $tpl$Redefinição de senha — {nome_escola}$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Recebemos uma solicitação para redefinir a sua senha.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="{link_recuperacao}" style="display:inline-block;background:#06b6d4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Redefinir senha →</a>
    </p>
    <p>Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'link_recuperacao', 'nome_escola']::text[]),
('lead_confirmacao', $tpl$Confirmação de inscrição (campanha)$tpl$, $tpl$Recebemos sua inscrição — {nome_campanha}$tpl$,
$tpl$<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Recebemos a sua inscrição em <strong>{nome_campanha}</strong>. Obrigado pelo interesse!</p>
    <p>Nossa equipe entrará em contato em breve pelo telefone que você informou.</p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>$tpl$,
array['nome_cliente', 'nome_campanha', 'nome_escola']::text[])
on conflict (id) do nothing;
