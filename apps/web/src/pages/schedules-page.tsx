import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SchedulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Scheduler UI scaffold for the next phase. No /api/schedules endpoints are assumed yet."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Not implemented yet</CardTitle>
            <CardDescription>This page stays intentionally honest until scheduler endpoints exist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>The backend does not expose schedule APIs in the current phase, so the frontend avoids inventing placeholder data.</p>
            <p>When scheduler support lands, this page is ready to host the list, detail, and create flows without changing the rest of the app shell.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planned integration</CardTitle>
            <CardDescription>What this area is reserved for in the next phase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Expected next steps are schedule listing, target-host selection, and run history scoped to future scheduler routes.</p>
            <p>The page remains part of the shell now so navigation feels complete without implying missing backend behavior.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
