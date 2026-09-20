import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { extrairSendToGoogleAds, scriptJaDisparaPageView } from "@/lib/pixels/analisar";
import { isPixelTipo, type PixelTipo } from "@/lib/pixels/tipos";

export type PixelParaPagina = {
  id: string;
  tipo: PixelTipo;
  script: string;
  // O código colado já dispara o page view sozinho (evita contar em dobro).
  pageViewAutomatico: boolean;
  // Google Ads: destino dos eventos (AW-ID ou AW-ID/rótulo).
  sendTo: string | null;
};

type LinhaPixel = { id: string; tipo: string; script: string; cursos_ids: string[] | null };

// Pixels ATIVOS que valem pra uma página pública. `cursoId`: curso ligado à página
// (a campanha tem; o agendamento não). Pixel sem restrição de curso vale em todas as
// páginas; pixel restrito só nas de um dos cursos listados.
//
// Client admin (service_role): página pública não tem sessão. Nunca lança — tabela
// ausente (migration pendente) ou erro = nenhum pixel, e a página carrega normal.
export async function getPixelsParaPagina(cursoId?: string | null): Promise<PixelParaPagina[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("pixels_config")
      .select("id, tipo, script, cursos_ids")
      .eq("ativo", true)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    return (data as LinhaPixel[])
      .filter((pixel) => {
        const cursos = pixel.cursos_ids ?? [];
        return cursos.length === 0 || (!!cursoId && cursos.includes(cursoId));
      })
      .flatMap((pixel) => {
        if (!isPixelTipo(pixel.tipo)) return [];
        return [
          {
            id: pixel.id,
            tipo: pixel.tipo,
            script: pixel.script,
            pageViewAutomatico: scriptJaDisparaPageView(pixel.tipo, pixel.script),
            sendTo: pixel.tipo === "google_ads" ? extrairSendToGoogleAds(pixel.script) : null,
          },
        ];
      });
  } catch {
    return [];
  }
}
