import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CalendarLauncher } from "./CalendarLauncher";
import { SteamStoreLinkBehavior } from "./SteamStoreLinkBehavior";
import { WeeklyReportLauncher } from "./WeeklyReportLauncher";
import "./design-tokens.css";
import "./styles.css";
import "./calendar.css";
import "./calendar-refinement.css";
import "./detail-ux-refinement.css";
import "./lead-evidence.css";
import "./weekly-report.css";
import "./pipeline-actions.css";
import "./funnel-workflow.css";
import "./brand-overrides.css";
import "./aesthetic-refresh.css";
import "./automation-diagnostics.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <CalendarLauncher />
    <WeeklyReportLauncher />
    <SteamStoreLinkBehavior />
  </React.StrictMode>
);
