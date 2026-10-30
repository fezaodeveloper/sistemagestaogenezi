"use client";

// "use client": clipboard, selects controlados e seção colapsável — tudo sem precisar de
// Server Action (UTM não é um dado salvo em campanha_paginas, só parâmetros de URL montados
// aqui e lidos de volta na página pública via searchParams, ver src/app/campanha/[slug]/page.tsx).

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const URL_SITE_PADRAO = "https://escola.genezi.com.br";

const ORIGENS_UTM = ["instagram", "facebook", "whatsapp", "google", "outro"] as const;
const ORIGEM_UTM_LABELS: Record<(typeof ORIGENS_UTM)[number], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  google: "Google",
  outro: "Outro",
};

const MEIOS_UTM = ["stories", "feed", "grupo", "bio", "outro"] as const;
const MEIO_UTM_LABELS: Record<(typeof MEIOS_UTM)[number], string> = {
  stories: "Stories",
  feed: "Feed",
  grupo: "Grupo",
  bio: "Bio",
  outro: "Outro",
};

// TAREFA CRM 2.2 (PARTE 3) — gerador de link com UTM pra página pública de campanha. Não salva
// nada em campanha_paginas: o link gerado é só a mesma URL pública + query string, lida de
// volta pelos searchParams da própria página.
export function UtmLinkGenerator({ slug }: { slug: string }) {
  const [aberta, setAberta] = useState(false);
  const [origem, setOrigem] = useState<(typeof ORIGENS_UTM)[number]>("instagram");
  const [meio, setMeio] = useState<(typeof MEIOS_UTM)[number]>("stories");
  const [copiado, setCopiado] = useState(false);

  const urlBase = (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
  const link = `${urlBase}/campanha/${slug}?utm_source=${origem}&utm_medium=${meio}&utm_campaign=${slug}`;

  function copiarLink() {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {
        // Clipboard indisponível — o link continua visível pra copiar na mão.
      });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAberta((atual) => !atual)}
          className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
        >
          🔗 Links de rastreamento
          {aberta ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {aberta && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
              URL base: {urlBase}/campanha/{slug}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Origem</Label>
                <Select
                  items={ORIGEM_UTM_LABELS}
                  value={origem}
                  onValueChange={(valor) => valor && setOrigem(valor as (typeof ORIGENS_UTM)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS_UTM.map((o) => (
                      <SelectItem key={o} value={o}>
                        {ORIGEM_UTM_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Meio</Label>
                <Select
                  items={MEIO_UTM_LABELS}
                  value={meio}
                  onValueChange={(valor) => valor && setMeio(valor as (typeof MEIOS_UTM)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEIOS_UTM.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MEIO_UTM_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted rounded-md p-2 text-xs break-all">{link}</div>

            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={copiarLink}>
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiado ? "Copiado!" : "Copiar link"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
