import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  BookOpen,
  History,
  KeyRound,
  Plug,
  Settings as SettingsIcon,
  Workflow as WorkflowIcon,
  Wrench,
} from "lucide-react";
import { cx } from "./components/ui.tsx";
import { useWorkspace } from "./lib/workspace.ts";
import WorkflowsPage from "./pages/Workflows.tsx";
import BuilderPage from "./pages/Builder.tsx";
import RunsPage from "./pages/Runs.tsx";
import KnowledgePage from "./pages/Knowledge.tsx";
import McpPage from "./pages/McpServers.tsx";
import ToolsPage from "./pages/Tools.tsx";
import SettingsPage from "./pages/Settings.tsx";

const NAV = [
  { to: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { to: "/runs", label: "Runs", icon: History },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/mcp", label: "MCP servers", icon: Plug },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const { settings, loaded, refresh } = useWorkspace();
  const location = useLocation();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The builder owns the full viewport; everything else scrolls in a column.
  const isBuilder = location.pathname.startsWith("/workflows/");

  return (
    <div className="flex h-full">
      <aside className="flex w-[196px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-ground">
            A
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">Agent Studio</div>
            <div className="text-[10px] text-ink-faint">Claude workflows</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
                  isActive
                    ? "bg-hover font-medium text-ink"
                    : "text-ink-muted hover:bg-hover hover:text-ink",
                )
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {loaded && settings && !settings.apiKey.configured ? (
          <NavLink
            to="/settings"
            className="m-2 flex items-start gap-2 rounded-lg border border-[#5a4520] bg-[#2a2110] px-2.5 py-2 text-[11px] leading-snug text-human hover:bg-[#332815]"
          >
            <KeyRound size={13} className="mt-px shrink-0" />
            <span>
              <strong className="font-semibold">No API key.</strong> Agent nodes will fail until you
              add one.
            </span>
          </NavLink>
        ) : null}
      </aside>

      <main className={cx("min-w-0 flex-1", isBuilder ? "overflow-hidden" : "overflow-y-auto")}>
        <Routes>
          <Route path="/" element={<Navigate to="/workflows" replace />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:id" element={<BuilderPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:id" element={<RunsPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/mcp" element={<McpPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/workflows" replace />} />
        </Routes>
      </main>
    </div>
  );
}
