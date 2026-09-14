import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { SoloFocusProvider } from "./context";
import { SoloSidebar } from "./components/SoloSidebar";
import { SoloTopHeader } from "./components/SoloTopHeader";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { ProjectModal } from "./components/ProjectModal";
import { DomainModal } from "./components/DomainModal";
import { HabitModal } from "./components/HabitModal";
import { SopModal } from "./components/SopModal";
import { RestoreSafetyModal } from "./components/RestoreSafetyModal";
import { QuickCaptureModal } from "./components/QuickCaptureModal";
import { EveningShutdownModal } from "./components/EveningShutdownModal";
import { Toast } from "./components/Toast";

import { TodayDeskPage } from "./pages/TodayDeskPage";
import { AllTasksPage } from "./pages/AllTasksPage";
import { AllProjectsPage } from "./pages/AllProjectsPage";
import { DomainsAndGoalsPage } from "./pages/DomainsAndGoalsPage";
import { HabitTrackerPage } from "./pages/HabitTrackerPage";
import { SopKnowledgeBasePage } from "./pages/SopKnowledgeBasePage";
import { SettingsArchivePage } from "./pages/SettingsArchivePage";

export function SoloFocusApp() {
  const navigate = useNavigate();

  return (
    <SoloFocusProvider>
      <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen">
        {/* Left Navigation Rail (64 width = 256px) */}
        <SoloSidebar basePath="" />

        {/* Top Header & Main Content Area */}
        <div className="pl-64 flex flex-col min-h-screen">
          <SoloTopHeader />

          <main className="w-full pt-20 bg-surface flex-1 px-gutter-desktop pb-8">
            <Routes>
              <Route
                path=""
                element={
                  <TodayDeskPage
                    onNavigateToAllTasks={() => navigate("/all-tasks")}
                  />
                }
              />
              <Route
                path="today-workspace"
                element={
                  <TodayDeskPage
                    onNavigateToAllTasks={() => navigate("/all-tasks")}
                  />
                }
              />
              <Route
                path="today"
                element={
                  <TodayDeskPage
                    onNavigateToAllTasks={() => navigate("/all-tasks")}
                  />
                }
              />
              <Route path="all-tasks" element={<AllTasksPage />} />
              <Route path="tasks" element={<AllTasksPage />} />
              <Route path="all-projects" element={<AllProjectsPage />} />
              <Route path="projects" element={<AllProjectsPage />} />
              <Route
                path="domains-and-goals"
                element={
                  <DomainsAndGoalsPage
                    onNavigateToProjects={() => navigate("/all-projects")}
                  />
                }
              />
              <Route
                path="areas"
                element={
                  <DomainsAndGoalsPage
                    onNavigateToProjects={() => navigate("/all-projects")}
                  />
                }
              />
              <Route path="habit-tracker" element={<HabitTrackerPage />} />
              <Route path="habits" element={<HabitTrackerPage />} />
              <Route
                path="sop-knowledge-base"
                element={
                  <SopKnowledgeBasePage
                    onNavigateToToday={() => navigate("/")}
                  />
                }
              />
              <Route
                path="sops"
                element={
                  <SopKnowledgeBasePage
                    onNavigateToToday={() => navigate("/")}
                  />
                }
              />
              <Route
                path="daily-sop"
                element={
                  <SopKnowledgeBasePage
                    onNavigateToToday={() => navigate("/")}
                  />
                }
              />
              <Route path="settings" element={<SettingsArchivePage />} />
              <Route path="settings-and-archive" element={<SettingsArchivePage />} />
              <Route
                path="*"
                element={
                  <TodayDeskPage
                    onNavigateToAllTasks={() => navigate("/all-tasks")}
                  />
                }
              />
            </Routes>
          </main>
        </div>

        {/* Global Inspector Drawers & Modals */}
        <TaskDetailDrawer />
        <ProjectModal />
        <DomainModal />
        <HabitModal />
        <SopModal />
        <RestoreSafetyModal />
        <QuickCaptureModal />
        <EveningShutdownModal />
        <Toast />
      </div>
    </SoloFocusProvider>
  );
}
