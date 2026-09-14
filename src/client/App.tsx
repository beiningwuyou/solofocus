import { Component, lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components";
import { WorkbenchProvider } from "./context";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const TodayPage = lazy(() => import("./pages/ExecutionPages").then((m) => ({ default: m.TodayPage })));
const InboxPage = lazy(() => import("./pages/ExecutionPages").then((m) => ({ default: m.InboxPage })));
const TasksPage = lazy(() => import("./pages/ExecutionPages").then((m) => ({ default: m.TasksPage })));
const HabitsPage = lazy(() => import("./pages/HabitsPage").then((m) => ({ default: m.HabitsPage })));
const DailySopPage = lazy(() => import("./pages/DailySopPage").then((m) => ({ default: m.DailySopPage })));
const DailyRoutinePage = lazy(() => import("./pages/daily-routine/DailyRoutinePage").then((m) => ({ default: m.DailyRoutinePage })));
const SearchPage = lazy(() => import("./pages/SystemPages").then((m) => ({ default: m.SearchPage })));
const ArchivePage = lazy(() => import("./pages/SystemPages").then((m) => ({ default: m.ArchivePage })));
const SettingsPage = lazy(() => import("./pages/SystemPages").then((m) => ({ default: m.SettingsPage })));
const AreasPage = lazy(() => import("./pages/AreasPage").then((m) => ({ default: m.AreasPage })));

function PageLoading() {
  return <div className="page-loading" />;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div style={{ padding: 40, fontFamily: "system-ui" }}><h2 style={{ color: "#b91c1c" }}>页面加载失败</h2><pre style={{ background: "#fef2f2", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto", maxHeight: 300 }}>{this.state.error.message}{"\n\n"}{this.state.error.stack}</pre><button style={{ marginTop: 14, padding: "8px 16px", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" }} onClick={() => this.setState({ error: null })}>重试</button></div>;
    return this.props.children;
  }
}

const SoloFocusApp = lazy(() => import("./solofocus/SoloFocusApp").then((m) => ({ default: m.SoloFocusApp })));

export function App() {
  return <ErrorBoundary>
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Legacy personal-workbench preserved under /legacy/* */}
        <Route path="/legacy/*" element={
          <WorkbenchProvider>
            <AppShell>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/today" element={<TodayPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/areas" element={<AreasPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/habits" element={<HabitsPage />} />
                  <Route path="/daily-sop" element={<DailySopPage />} />
                  <Route path="/daily-routine" element={<DailyRoutinePage />} />
                  <Route path="/plans" element={<Navigate to="/legacy/projects" replace />} />
                  <Route path="/goals" element={<Navigate to="/legacy/projects" replace />} />
                  <Route path="/milestones" element={<Navigate to="/legacy/projects" replace />} />
                  <Route path="/metrics" element={<Navigate to="/legacy" replace />} />
                  <Route path="/opportunities" element={<Navigate to="/legacy/projects" replace />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/archive" element={<ArchivePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/legacy" replace />} />
                </Routes>
              </Suspense>
            </AppShell>
          </WorkbenchProvider>
        } />

        {/* SoloFocus is the Primary Application at Root */}
        <Route path="/*" element={<SoloFocusApp />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>;
}
