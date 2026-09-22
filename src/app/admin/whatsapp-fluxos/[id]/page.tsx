import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isFluxoGatilho, parseNos } from "@/lib/whatsapp/fluxos-tipos";
import { WhatsappFluxoCanvas } from "@/components/admin/whatsapp-fluxo-canvas";
import { WhatsappFluxoExecucoes } from "@/components/admin/whatsapp-fluxo-execucoes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function WhatsappFluxoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("whatsapp_fluxos").select("id, nome, descricao, gatilho, nos").eq("id", id).maybeSingle();
  if (!data || !isFluxoGatilho(data.gatilho)) notFound();

  const nos = parseNos(data.nos);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button render={<Link href="/admin/whatsapp-fluxos" />} nativeButton={false} variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft />
          Fluxos de WhatsApp
        </Button>
        <h1 className="text-2xl font-semibold">{data.nome}</h1>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
        </TabsList>
        <TabsContent value="editor">
          <WhatsappFluxoCanvas fluxoId={data.id} gatilho={data.gatilho} nomeInicial={data.nome} descricaoInicial={data.descricao ?? ""} nosIniciais={nos} />
        </TabsContent>
        <TabsContent value="execucoes">
          <WhatsappFluxoExecucoes fluxoId={data.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
