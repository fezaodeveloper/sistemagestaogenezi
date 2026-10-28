-- Gênezi Conecta reusa a MESMA tabela termos_legais do portal do aluno (REGRA da tarefa) — só
-- amplia o CHECK de "chave" pras 5 novas (prefixo "conecta_") e semeia o conteúdo atual das 4
-- páginas estáticas públicas + o texto do checkbox de acompanhamento do menor. Nenhuma coluna
-- nova, nenhum GRANT novo: os grants de update(conteudo, titulo, atualizado_em, atualizado_por)
-- já concedidos em 20260917600000_termos_legais.sql são por COLUNA, não por linha — já cobrem
-- as linhas novas automaticamente.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.termos_legais drop constraint if exists termos_legais_chave_check;
alter table public.termos_legais add constraint termos_legais_chave_check
  check (chave in (
    'privacidade', 'termos', 'lgpd', 'imagem',
    'conecta_termos_uso', 'conecta_privacidade', 'conecta_cookies', 'conecta_lgpd', 'conecta_menor_termo'
  ));

insert into public.termos_legais (chave, titulo, conteudo) values
('conecta_termos_uso', 'Termos de Uso — Gênezi Conecta', $$<p>O Gênezi Conecta é um portal de oportunidades de emprego e estágio mantido pela Escola Gênezi ("Gênezi", "nós"), que conecta candidatos a empresas parceiras da região. Ao acessar ou se cadastrar no Gênezi Conecta, você concorda com estes Termos de Uso.</p>
<h2>1. Quem pode usar o Gênezi Conecta</h2>
<p>O cadastro como candidato é permitido a partir de 16 anos completos. Candidatos com 16 ou 17 anos devem declarar, no momento do cadastro ou da ativação da visibilidade do perfil, que serão acompanhados por um dos pais ou responsável legal em qualquer entrevista de emprego decorrente do uso da plataforma. Candidatos menores de 16 anos não podem se cadastrar.</p>
<h2>2. Alunos da Gênezi e candidatos externos</h2>
<p>Alunos com matrícula ativa na Gênezi têm acesso gratuito ao Gênezi Conecta pelo portal do aluno. Candidatos que não são alunos ("candidatos externos") podem participar mediante assinatura de um dos planos pagos disponíveis no cadastro, cobrada de forma recorrente através do nosso processador de pagamentos.</p>
<h2>3. Cadastro de empresas</h2>
<p>O cadastro de empresas parceiras não é aberto ao público: depende de contato prévio com a escola (por exemplo, via WhatsApp) e da obtenção de um código de acesso fornecido após uma avaliação simples do perfil da empresa. A publicação de vagas por empresas aprovadas é gratuita.</p>
<h2>4. Veracidade das informações</h2>
<p>Você é responsável pela exatidão dos dados informados no cadastro (seus ou de sua empresa) e pela atualização deles quando necessário. A Gênezi pode suspender ou cancelar cadastros com informações falsas, incompletas de forma intencional, ou usados para fins diferentes de recrutamento e candidatura a vagas de emprego.</p>
<h2>5. Papel da Gênezi na relação entre candidato e empresa</h2>
<p>A Gênezi atua como ponto de encontro entre candidatos e empresas, divulgando vagas e perfis profissionais. Não somos parte da relação de trabalho, estágio ou entrevista que venha a existir entre candidato e empresa, e não garantimos contratação, remuneração ou condições de trabalho oferecidas por terceiros.</p>
<h2>6. Conduta esperada</h2>
<p>É proibido usar o Gênezi Conecta para fins discriminatórios, para publicar vagas ou perfis falsos, para coletar dados de outros usuários fora do contexto de recrutamento, ou para qualquer finalidade ilícita. Contas que violem estas regras podem ser suspensas ou excluídas, a critério da Gênezi.</p>
<h2>7. Cancelamento</h2>
<p>Candidatos externos podem cancelar a assinatura a qualquer momento; o acesso permanece até o fim do período já pago. Empresas podem solicitar o encerramento do cadastro pelo mesmo canal usado para a aprovação inicial. A Gênezi pode encerrar o serviço do Gênezi Conecta, total ou parcialmente, mediante aviso razoável.</p>$$),

('conecta_privacidade', 'Política de Privacidade — Gênezi Conecta', $$<p>Esta Política de Privacidade explica como a Escola Gênezi ("Gênezi") coleta, usa e protege os dados pessoais de quem usa o Gênezi Conecta, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
<h2>1. Dados que coletamos</h2>
<p>De candidatos (alunos e externos): nome, e-mail, WhatsApp, cidade/estado, data de nascimento, resumo profissional, experiências, currículo (PDF) e, para candidatos externos, CPF e dados de pagamento processados pelo nosso parceiro de cobrança. De empresas: nome da empresa, CNPJ, dados do responsável, WhatsApp, e-mail, endereço e logotipo.</p>
<h2>2. Para que usamos esses dados</h2>
<ul>
<li>Exibir seu perfil profissional a empresas parceiras, quando você optar por tornar o perfil visível;</li>
<li>Processar pagamentos de assinaturas de candidatos externos;</li>
<li>Avaliar e aprovar o cadastro de empresas parceiras;</li>
<li>Enviar comunicações relacionadas ao seu cadastro, candidatura ou assinatura (e-mail e WhatsApp);</li>
<li>Cumprir obrigações legais e proteger a segurança da plataforma.</li>
</ul>
<h2>3. Com quem compartilhamos dados</h2>
<p>O WhatsApp, nome, cursos concluídos na Gênezi (quando aplicável) e currículo de candidatos com perfil visível são compartilhados com empresas parceiras com cadastro ativo. Dados de pagamento de candidatos externos são processados por nosso parceiro de cobrança (Asaas), que trata esses dados sob sua própria política de privacidade. Não vendemos dados pessoais a terceiros.</p>
<h2>4. Candidatos menores de idade</h2>
<p>Candidatos com 16 ou 17 anos só têm o perfil exibido a empresas após declarar que serão acompanhados por um responsável legal em eventuais entrevistas. Não coletamos dados de menores de 16 anos — o cadastro é bloqueado nesses casos.</p>
<h2>5. Retenção e exclusão</h2>
<p>Mantemos seus dados enquanto o cadastro estiver ativo ou enquanto necessário para cumprir obrigações legais (ex.: fiscais, no caso de pagamentos). Você pode solicitar a exclusão do seu cadastro e dos dados associados a qualquer momento, pelo WhatsApp de contato da escola.</p>
<h2>6. Segurança</h2>
<p>Senhas são armazenadas de forma criptografada (nunca em texto puro). Currículos em PDF ficam em um repositório privado, acessível apenas mediante link temporário gerado sob demanda. Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados contra acesso não autorizado.</p>
<h2>7. Seus direitos</h2>
<p>Você pode solicitar a qualquer momento a confirmação, correção, portabilidade ou exclusão dos seus dados, bem como informações sobre o compartilhamento deles, conforme detalhado na nossa página de LGPD.</p>$$),

('conecta_cookies', 'Política de Cookies — Gênezi Conecta', $$<p>Cookies são pequenos arquivos armazenados no seu navegador para que um site lembre informações entre visitas. Esta política explica como o Gênezi Conecta os utiliza.</p>
<h2>1. Cookies essenciais</h2>
<p>Usamos cookies estritamente necessários para manter sua sessão autenticada quando você entra como empresa (no painel em /empresa) ou como aluno (no portal em /aluno). Sem esses cookies, não é possível permanecer logado entre páginas. Eles não exigem consentimento, por serem indispensáveis ao funcionamento do serviço.</p>
<h2>2. Cookies que não usamos</h2>
<p>O Gênezi Conecta não utiliza cookies de publicidade, de rastreamento entre sites ou de redes sociais. Não compartilhamos dados de navegação com anunciantes.</p>
<h2>3. Armazenamento local do navegador</h2>
<p>Em algumas telas do portal do responsável e do aluno, usamos o armazenamento local do navegador (sessionStorage) apenas para manter você conectado durante a mesma aba, sem precisar digitar a senha novamente a cada recarregamento. Essa informação fica só no seu dispositivo e é apagada ao fechar o navegador.</p>
<h2>4. Como gerenciar cookies</h2>
<p>Você pode bloquear ou apagar cookies pelas configurações do seu navegador. Como os cookies do Gênezi Conecta são essenciais para login, bloqueá-los impede o acesso a áreas autenticadas (painel da empresa e portal do aluno), mas não afeta a navegação pelas páginas públicas, como a lista de vagas.</p>$$),

('conecta_lgpd', 'LGPD — Seus direitos no Gênezi Conecta', $$<p>A Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD) garante a você, titular dos dados, uma série de direitos sobre as informações pessoais que a Escola Gênezi trata no Gênezi Conecta. Esta página resume esses direitos e como exercê-los.</p>
<h2>1. Seus direitos como titular</h2>
<ul>
<li>Confirmação de que tratamos dados seus, e acesso a eles;</li>
<li>Correção de dados incompletos, inexatos ou desatualizados;</li>
<li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
<li>Portabilidade dos dados a outro fornecedor de serviço, mediante requisição expressa;</li>
<li>Eliminação dos dados tratados com o seu consentimento, quando não houver outra base legal para a manutenção deles;</li>
<li>Informação sobre com quem compartilhamos seus dados;</li>
<li>Revogação do consentimento, quando o tratamento se basear nele (por exemplo, ao tornar seu perfil visível a empresas).</li>
</ul>
<h2>2. Base legal do tratamento</h2>
<p>Tratamos dados de candidatos e empresas principalmente com base na execução de contrato ou procedimentos preliminares a ele (viabilizar a candidatura a vagas e a publicação de vagas), no consentimento (ao ativar a visibilidade do perfil) e no cumprimento de obrigação legal ou regulatória (por exemplo, dados fiscais ligados a pagamentos de assinaturas).</p>
<h2>3. Candidatos de 16 e 17 anos</h2>
<p>Para candidatos nessa faixa de idade, o consentimento para ter o perfil visível a empresas é acompanhado da declaração de que um responsável legal estará presente em entrevistas decorrentes da candidatura — uma salvaguarda adicional, não prevista genericamente na lei, mas adotada pela Gênezi por responsabilidade com menores.</p>
<h2>4. Como exercer seus direitos</h2>
<p>Envie sua solicitação pelo WhatsApp de contato da escola, disponível na página do Gênezi Conecta, informando seu nome completo e o e-mail usado no cadastro. Responderemos em prazo razoável, podendo solicitar informações adicionais para confirmar sua identidade antes de atender ao pedido.</p>
<h2>5. Encarregado de dados</h2>
<p>Dúvidas sobre o tratamento de dados pessoais no Gênezi Conecta podem ser direcionadas ao mesmo canal de contato da escola. Veja também nossa Política de Privacidade.</p>$$),

('conecta_menor_termo', 'Termo de Acompanhamento do Menor (16-17 anos)', $$<p>Declaro que serei acompanhado por um dos meus pais ou responsável legal em qualquer entrevista de emprego.</p>$$)
on conflict (chave) do nothing;
