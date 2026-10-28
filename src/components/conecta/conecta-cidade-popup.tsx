"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MENSAGEM_WHATSAPP_EMPRESAS = encodeURIComponent(
  "Olá! Tenho interesse em cadastrar minha empresa no Gênezi Conecta e disponibilizar vagas para os alunos.",
);

export function ConectaCidadePopup({
  cidade,
  onOpenChange,
  whatsappEscolaDigitos,
}: {
  cidade: string | null;
  onOpenChange: (open: boolean) => void;
  whatsappEscolaDigitos: string | null;
}) {
  return (
    <Dialog open={cidade !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vagas em {cidade}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <p className="font-medium">🎓 Já sou aluno Gênezi</p>
              <p className="text-muted-foreground text-sm">Acesse o portal e candidate-se com seu perfil.</p>
              <Button size="sm" className="w-fit" nativeButton={false} render={<Link href="/aluno" />}>
                Acessar portal do aluno →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <p className="font-medium">💼 Quero assinar o plano</p>
              <p className="text-muted-foreground text-sm">Acesse vagas exclusivas como candidato externo.</p>
              <Button size="sm" className="w-fit" nativeButton={false} render={<Link href="/conecta/cadastro" />}>
                Assinar o Gênezi Conecta →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <p className="font-medium">🏢 Sou empresa e quero publicar vagas</p>
              <p className="text-muted-foreground text-sm">Cadastre sua empresa gratuitamente.</p>
              {whatsappEscolaDigitos ? (
                <Button
                  size="sm"
                  className="w-fit bg-green-600 hover:bg-green-700"
                  nativeButton={false}
                  render={
                    <a
                      href={`https://wa.me/55${whatsappEscolaDigitos}?text=${MENSAGEM_WHATSAPP_EMPRESAS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Falar no WhatsApp →
                </Button>
              ) : (
                <Button size="sm" className="w-fit" disabled>
                  WhatsApp não configurado
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="justify-center sm:justify-center">
          <p className="text-muted-foreground text-sm">
            Já tem conta?{" "}
            <Link href="/empresa/login" className="text-foreground underline underline-offset-2">
              Entrar
            </Link>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
