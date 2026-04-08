import type { HostRecord } from "@/types/api";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface HostsGridProps {
  hosts: HostRecord[];
}

export function HostsGrid({ hosts }: HostsGridProps) {
  if (hosts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No hosts are registered in the current backend database.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {hosts.map((host) => (
        <Card key={host.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{host.id}</CardTitle>
                <CardDescription>{host.machineType}</CardDescription>
              </div>
              <Badge variant={host.isActive ? "success" : "outline"}>{host.isActive ? "Active" : "Inactive"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Base URL</p>
                <p className="mt-1 break-all font-mono text-xs">{host.baseUrl}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Updated</p>
                <p className="mt-1 text-sm">{formatDateTime(host.updatedAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Capabilities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {host.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Enabled tools</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {host.enabledTools.map((tool) => (
                  <Badge key={tool} variant="outline">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
