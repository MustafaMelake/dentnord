import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for a page inside the portal/admin shell. */
export function PageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-5 w-80 max-w-full rounded-lg" />
      </div>
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}
