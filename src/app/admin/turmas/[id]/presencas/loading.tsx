import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function PresencasLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-b-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </Card>
    </div>
  );
}
