import { useQuery } from "@tanstack/react-query";

import { getHosts } from "@/lib/api";
import { HostsGrid } from "@/components/hosts/hosts-grid";
import { PageHeader } from "@/components/layout/page-header";

export function HostsPage() {
  const hostsQuery = useQuery({
    queryKey: ["hosts"],
    queryFn: getHosts,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hosts"
        description="Registered execution hosts from the backend database, including machine type and enabled tools."
      />

      {hostsQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-10 text-sm text-muted-foreground">
          Loading hosts...
        </div>
      ) : (
        <HostsGrid hosts={hostsQuery.data ?? []} />
      )}
    </div>
  );
}
