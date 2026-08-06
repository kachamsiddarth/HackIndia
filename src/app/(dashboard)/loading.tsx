import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return <div style={{ padding: "2rem", display: "grid", gap: "1rem" }} aria-label="Loading dashboard content" aria-busy="true"><Skeleton height={34} width="35%" /><Skeleton height={160} /><Skeleton height={160} /></div>;
}
