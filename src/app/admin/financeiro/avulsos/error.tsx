"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AvulsosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm">Algo deu errado ao carregar os pagamentos avulsos.</p>
        <Button onClick={() => reset()} variant="outline">
          Tentar de novo
        </Button>
      </CardContent>
    </Card>
  );
}
