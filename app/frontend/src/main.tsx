import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CalendarLauncher } from "./CalendarLauncher";
import { DetailUxRefinement } from "./DetailUxRefinement";
import { ManualLeadLauncher } from "./ManualLeadLauncher";
import { ReviewQueueBehavior } from "./ReviewQueueBehavior";
import { SteamStoreLinkBehavior } from "./SteamStoreLinkBehavior";
import "./styles.css";
import "./calendar.css";
import "./calendar-refinement.css";
import "./detail-ux-refinement.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <CalendarLauncher />
    <ManualLeadLauncher />
    <ReviewQueueBehavior />
    <SteamStoreLinkBehavior />
    <DetailUxRefinement />
  </React.StrictMode>
);
