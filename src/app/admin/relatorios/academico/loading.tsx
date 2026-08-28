import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RelatorioAcademicoLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Skeleton className="h-14 w-64" />
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </CardContent>
      </Card>
    </div>
  );
}
