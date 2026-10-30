export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-56 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-24 w-full animate-pulse rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-muted h-64 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-64 w-full animate-pulse rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-muted h-56 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-56 w-full animate-pulse rounded-md" />
      </div>
    </div>
  );
}
