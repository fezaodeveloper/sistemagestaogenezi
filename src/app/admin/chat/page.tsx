import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAlunosElegiveisParaChat, getConversasAdmin } from "@/lib/chat/chat";
import { NovaConversaSelect } from "@/components/admin/nova-conversa-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDateTimeBR(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default async function ChatPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [conversas, alunosElegiveis] = await Promise.all([
    getConversasAdmin(supabase),
    getAlunosElegiveisParaChat(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-muted-foreground text-sm">
          Conversas com alunos de cursos presenciais ou híbridos. Uma conversa por aluno,
          compartilhada entre todos os admins.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-sm font-medium">Nova conversa</p>
          <NovaConversaSelect alunos={alunosElegiveis} />
        </CardContent>
      </Card>

      {conversas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma conversa iniciada ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Última mensagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.alunoNome ?? "Aluno"}</TableCell>
                  <TableCell>{formatDateTimeBR(c.ultima_mensagem_em)}</TableCell>
                  <TableCell>
                    {c.naoLidas > 0 ? (
                      <Badge variant="destructive">{c.naoLidas} não lida{c.naoLidas > 1 ? "s" : ""}</Badge>
                    ) : (
                      <Badge variant="secondary">Em dia</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/chat/${c.aluno_id}`} className="text-primary text-sm hover:underline">
                      Abrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
