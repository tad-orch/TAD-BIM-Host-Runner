import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { ChatPage } from "@/pages/chat-page";
import { HostsPage } from "@/pages/hosts-page";
import { JobsPage } from "@/pages/jobs-page";
import { SchedulesPage } from "@/pages/schedules-page";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/chat" />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/hosts" element={<HostsPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
      </Route>
    </Routes>
  );
}
