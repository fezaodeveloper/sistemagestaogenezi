import { Mail, Phone, User } from "lucide-react";
import type { DadosResponsavelLogado } from "@/app/responsavel/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDataBR } from "@/lib/responsavel/formatacao";

// CPF mascarado (mostra os 6 primeiros dígitos, esconde o resto — formato "078.534.***-**", igual
// ao exemplo da tarefa) — o responsável já sabe o próprio CPF, não precisa ver o completo aqui.
function mascararCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "").padEnd(11, "0");
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.***-**`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function SecaoPerfil({ responsavel }: { responsavel: DadosResponsavelLogado }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meu perfil</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-muted flex size-16 items-center justify-center rounded-full">
            {responsavel.nomeResponsavel ? (
              <span className="text-xl font-semibold">{iniciais(responsavel.nomeResponsavel)}</span>
            ) : (
              <User className="text-muted-foreground size-8" />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold">{responsavel.nomeResponsavel}</span>
            <span className="text-muted-foreground text-sm">CPF: {mascararCpf(responsavel.cpf)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {responsavel.telefone && (
            <span className="flex items-center gap-1.5">
              <Phone className="text-muted-foreground size-3.5" />
              {responsavel.telefone}
            </span>
          )}
          {responsavel.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="text-muted-foreground size-3.5" />
              {responsavel.email}
            </span>
          )}
          <span className="text-muted-foreground">Cadastrado em {formatDataBR(responsavel.cadastradoEm)}</span>
        </div>

        <p className="text-muted-foreground border-t pt-3 text-xs">
          Para atualizar seus dados, entre em contato com a escola.
        </p>
      </CardContent>
    </Card>
  );
}
