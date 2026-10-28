import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITENS = [
  {
    pergunta: "O que é o Gênezi Conecta?",
    resposta:
      "O Gênezi Conecta é um portal de oportunidades de emprego criado pela Escola Gênezi para conectar nossos alunos com empresas parceiras da região. Alunos têm acesso gratuito ao candidatar-se às vagas.",
  },
  {
    pergunta: "Preciso ser aluno da escola para participar?",
    resposta:
      "Não necessariamente. Alunos da escola participam gratuitamente. Candidatos externos podem participar através de um plano de assinatura.",
  },
  {
    pergunta: "Como uma empresa pode publicar vagas?",
    resposta:
      "Entre em contato conosco pelo WhatsApp. Analisamos seu perfil e, após aprovação, liberamos o acesso para publicar vagas gratuitamente.",
  },
  {
    pergunta: "Há algum custo para os candidatos?",
    resposta:
      "Para alunos da escola, o acesso é completamente gratuito. Candidatos externos têm planos de assinatura disponíveis.",
  },
  {
    pergunta: "Com que idade posso me candidatar?",
    resposta:
      "A partir de 16 anos. Candidatos entre 16 e 17 anos precisam assinar um termo de compromisso sobre acompanhamento parental em entrevistas.",
  },
  {
    pergunta: "Como vejo os detalhes das vagas?",
    resposta:
      "Alunos acessam pelo portal do aluno. Candidatos externos acessam após criar uma conta e ativar a assinatura.",
  },
] as const;

export function ConectaFaq() {
  return (
    <Accordion className="mx-auto w-full max-w-2xl">
      {FAQ_ITENS.map((item, index) => (
        <AccordionItem key={item.pergunta} value={`item-${index}`}>
          <AccordionTrigger>{item.pergunta}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.resposta}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
