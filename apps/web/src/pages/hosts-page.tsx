import { useQuery } from "@tanstack/react-query";

import { getHosts } from "@/lib/api";
import { HostsGrid } from "@/components/hosts/hosts-grid";
import { PageHeader } from "@/components/layout/page-header";

export function HostsPage() {
  const hostsQuery = useQuery({
    queryKey: ["hosts"],
    queryFn: getHosts,
  });
  const hosts = hostsQuery.data ?? [];
  const activeHostsCount = hosts.filter((host) => host.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hosts"
        description="Registered execution hosts from the backend database, including machine type and enabled tools."
        actions={
          hosts.length > 0 ? (
            <>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {hosts.length} total
              </span>
              <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-700">
                {activeHostsCount} active
              </span>
            </>
          ) : undefined
        }
      />

      {hostsQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-10 text-sm text-muted-foreground">
          Loading hosts...
        </div>
      ) : (
        <HostsGrid hosts={hosts} />
      )}
    </div>
  );
}
