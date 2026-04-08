import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getHosts, getJobById, getJobs } from "@/lib/api";
import { formatDateTime, formatJson } from "@/lib/utils";
import type { JobStatus, StoredJobRecord } from "@/types/api";
import { JobsTable } from "@/components/jobs/jobs-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const ALL_FILTER = "all";
const statusOptions: JobStatus[] = ["accepted", "running", "completed", "failed", "timeout"];

function getStatusVariant(status: JobStatus) {
  switch (status) {
    case "completed":
      return "success";
    case "accepted":
    case "running":
      return "warning";
    case "failed":
    case "timeout":
      return "destructive";
    default:
      return "outline";
  }
}

export function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [hostFilter, setHostFilter] = useState<string>(ALL_FILTER);
  const [toolFilter, setToolFilter] = useState<string>(ALL_FILTER);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const hostsQuery = useQuery({
    queryKey: ["hosts"],
    queryFn: getHosts,
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs", statusFilter, hostFilter, toolFilter],
    queryFn: () =>
      getJobs({
        status: statusFilter !== ALL_FILTER ? statusFilter : undefined,
        targetHost: hostFilter !== ALL_FILTER ? hostFilter : undefined,
        tool: toolFilter !== ALL_FILTER ? toolFilter : undefined,
      }),
    refetchInterval: 5_000,
  });
  const selectedJobQuery = useQuery({
    queryKey: ["job", selectedJobId],
    queryFn: () => getJobById(selectedJobId!),
    enabled: Boolean(selectedJobId),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    const availableJobs = jobsQuery.data ?? [];

    if (availableJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    const hasSelectedJob = selectedJobId ? availableJobs.some((job) => job.jobId === selectedJobId) : false;

    if (!hasSelectedJob) {
      setSelectedJobId(availableJobs[0].jobId);
    }
  }, [jobsQuery.data, selectedJobId]);

  const selectedJob = selectedJobQuery.data ?? null;
  const jobs = jobsQuery.data ?? [];
  const activeFilterCount = useMemo(
    () => [statusFilter, hostFilter, toolFilter].filter((value) => value !== ALL_FILTER).length,
    [hostFilter, statusFilter, toolFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Inspect stored jobs through the existing /api/jobs endpoints with lightweight filters."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{jobs.length} jobs</Badge>
            {activeFilterCount > 0 ? <Badge variant="secondary">{activeFilterCount} active filters</Badge> : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Status, target host, and tool map directly to backend query params.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="job-status-filter">
              Status
            </label>
            <Select id="job-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value={ALL_FILTER}>All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="job-host-filter">
              Target host
            </label>
            <Select id="job-host-filter" value={hostFilter} onChange={(event) => setHostFilter(event.target.value)}>
              <option value={ALL_FILTER}>All hosts</option>
              {(hostsQuery.data ?? []).map((host) => (
                <option key={host.id} value={host.id}>
                  {host.id}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="job-tool-filter">
              Tool
            </label>
            <Input
              id="job-tool-filter"
              value={toolFilter === ALL_FILTER ? "" : toolFilter}
              placeholder="e.g. revit_create_wall"
              onChange={(event) => setToolFilter(event.target.value.trim() || ALL_FILTER)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(0,1.65fr)_420px]">
        <Card className="flex min-h-[clamp(32rem,calc(100vh-18rem),48rem)] flex-col">
          <CardHeader>
            <CardTitle>Latest jobs</CardTitle>
            <CardDescription>Ordered latest-first by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 min-h-0">
            <JobsTable jobs={jobs} selectedJobId={selectedJobId} onSelect={(job) => setSelectedJobId(job.jobId)} />
          </CardContent>
        </Card>

        <Card className="flex min-h-[clamp(32rem,calc(100vh-18rem),48rem)] flex-col">
          <CardHeader>
            <CardTitle>Job details</CardTitle>
            <CardDescription>Full stored payload from GET /api/jobs/:jobId.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1">
            {!selectedJob ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                Select a job to inspect its result or error payload.
              </div>
            ) : (
              <div className="flex flex-1 flex-col space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Detail label="Job ID" value={selectedJob.jobId} mono />
                  <Detail label="Tool" value={selectedJob.tool} />
                  <Detail
                    label="Status"
                    value={<Badge variant={getStatusVariant(selectedJob.status)}>{selectedJob.status}</Badge>}
                  />
                  <Detail label="Target host" value={selectedJob.targetHost} />
                  <Detail label="Created at" value={formatDateTime(selectedJob.createdAt)} />
                  <Detail label="Updated at" value={formatDateTime(selectedJob.updatedAt)} />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Result</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100">
                      {formatJson(selectedJob.result)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Error</p>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100">
                      {formatJson(selectedJob.error)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DetailProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function Detail({ label, value, mono = false }: DetailProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-sm"}>{value}</div>
    </div>
  );
}
