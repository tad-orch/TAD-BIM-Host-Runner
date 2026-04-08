import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SchedulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Scheduler UI scaffold for the next phase. No /api/schedules endpoints are assumed yet."
      />

      <Card>
        <CardHeader>
          <CardTitle>Not implemented yet</CardTitle>
          <CardDescription>This page is intentionally lightweight until scheduler endpoints exist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>The backend does not expose schedule APIs in the current phase, so the frontend avoids inventing placeholder data.</p>
          <p>When scheduler support lands, this page is ready to host the list, detail, and create flows without changing the rest of the app shell.</p>
        </CardContent>
      </Card>
    </div>
  );
}
