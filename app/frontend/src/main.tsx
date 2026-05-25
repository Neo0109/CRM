import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ManualLeadLauncher } from "./ManualLeadLauncher";
import { ReviewQueueBehavior } from "./ReviewQueueBehavior";
import { SteamStoreLinkBehavior } from "./SteamStoreLinkBehavior";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ManualLeadLauncher />
    <ReviewQueueBehavior />
    <SteamStoreLinkBehavior />
  </React.StrictMode>
);
