import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConversaPorAluno, getMensagens } from "@/lib/chat/chat";
import { ChatWindow } from "@/components/chat/chat-window";
import { Card, CardContent } from "@/components/ui/card";
import { enviarMensagemAluno, marcarConversaLidaAluno } from "./actions";

export default async function MensagensAlunoPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const conversa = await getConversaPorAluno(supabase, user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mensagens</h1>
        <p className="text-muted-foreground text-sm">Converse diretamente com a equipe da Gênezi.</p>
      </div>

      {!conversa ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma conversa iniciada ainda. Assim que a equipe entrar em contato, ela aparece aqui.
          </CardContent>
        </Card>
      ) : (
        <ChatWindow
          conversaId={conversa.id}
          currentUserId={user.id}
          outroLadoLabel="a equipe da Gênezi"
          initialMensagens={await getMensagens(supabase, conversa.id)}
          enviarAction={enviarMensagemAluno.bind(null, conversa.id)}
          marcarLidasAction={marcarConversaLidaAluno.bind(null, conversa.id)}
        />
      )}
    </div>
  );
}
