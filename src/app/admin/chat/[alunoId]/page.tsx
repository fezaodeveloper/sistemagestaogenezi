import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConversaPorAluno, getMensagens } from "@/lib/chat/chat";
import { ChatWindow } from "@/components/chat/chat-window";
import { IniciarConversaButton } from "@/components/admin/iniciar-conversa-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  editarMensagem,
  enviarMensagemAdmin,
  excluirMensagem,
  iniciarOuAbrirConversaAdmin,
  marcarConversaLidaAdmin,
} from "../actions";

export default async function ConversaAdminPage({
  params,
}: {
  params: Promise<{ alunoId: string }>;
}) {
  const user = await requireRole("admin");
  const { alunoId } = await params;

  const supabase = await createClient();
  const [{ data: perfil }, conversa] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", alunoId).single(),
    getConversaPorAluno(supabase, alunoId),
  ]);

  if (!perfil) {
    notFound();
  }

  const nomeAluno = perfil.full_name ?? "Aluno";

  if (!conversa) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{nomeAluno}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma conversa iniciada com este aluno ainda.</p>
            <IniciarConversaButton alunoId={alunoId} action={iniciarOuAbrirConversaAdmin} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const mensagens = await getMensagens(supabase, conversa.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{nomeAluno}</h1>
      </div>
      <ChatWindow
        conversaId={conversa.id}
        currentUserId={user.id}
        outroLadoLabel={nomeAluno}
        initialMensagens={mensagens}
        enviarAction={enviarMensagemAdmin.bind(null, conversa.id)}
        marcarLidasAction={marcarConversaLidaAdmin.bind(null, conversa.id)}
        podeAnexarArquivo
        podeEditarExcluir
        editarAction={editarMensagem}
        excluirAction={excluirMensagem}
      />
    </div>
  );
}
