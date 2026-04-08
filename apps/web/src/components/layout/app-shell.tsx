import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const navigation = [
  { to: "/chat", label: "Chat" },
  { to: "/jobs", label: "Jobs" },
  { to: "/hosts", label: "Hosts" },
  { to: "/schedules", label: "Schedules" },
];

export function AppShell() {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 md:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="surface rounded-[1.75rem] p-4 md:p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">TAD BIM</p>
            <h1 className="text-2xl font-semibold tracking-tight">Control Surface</h1>
            <p className="text-sm text-muted-foreground">
              Lightweight frontend for the existing MCP gateway and API.
            </p>
          </div>

          <nav className="mt-8 flex flex-col gap-2">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-border/80 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Backend</p>
            <p className="mt-2 font-mono text-sm text-foreground">http://127.0.0.1:8080</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vite proxies API traffic there by default during local development.
            </p>
          </div>
        </aside>

        <main className="surface rounded-[1.75rem] p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
