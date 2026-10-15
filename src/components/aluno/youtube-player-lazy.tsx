"use client";

// Wrapper client: `ssr: false` em next/dynamic só é permitido dentro de um Client Component
// (a page da aula é Server Component) — ver node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const YoutubePlayer = dynamic(
  () => import("@/components/aluno/youtube-player").then((m) => m.YoutubePlayer),
  {
    ssr: false,
    loading: () => <Skeleton className="aspect-video w-full rounded-lg" />,
  },
);
