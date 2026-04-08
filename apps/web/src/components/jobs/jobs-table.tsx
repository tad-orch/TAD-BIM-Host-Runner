import type { StoredJobRecord } from "@/types/api";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function getStatusVariant(status: StoredJobRecord["status"]) {
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

interface JobsTableProps {
  jobs: StoredJobRecord[];
  selectedJobId: string | null;
  onSelect: (job: StoredJobRecord) => void;
}

export function JobsTable({ jobs, selectedJobId, onSelect }: JobsTableProps) {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-border/80">
      <div className="h-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No jobs match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.jobId}
                  tabIndex={0}
                  className={cn(
                    "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    job.jobId === selectedJobId && "bg-primary/5",
                  )}
                  onClick={() => onSelect(job)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(job);
                    }
                  }}
                >
                  <TableCell className="break-all font-mono text-[11px]">{job.jobId}</TableCell>
                  <TableCell className="whitespace-nowrap">{job.tool}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{job.targetHost}</TableCell>
                  <TableCell>{formatDateTime(job.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
