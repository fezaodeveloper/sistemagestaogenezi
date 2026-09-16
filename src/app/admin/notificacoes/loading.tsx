export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-56 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-96 animate-pulse rounded-md" />
      </div>
      <div className="bg-muted h-20 w-full max-w-md animate-pulse rounded-md" />
      <div className="bg-muted h-96 w-full max-w-xl animate-pulse rounded-md" />
    </div>
  );
}
