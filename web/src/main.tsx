import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@vscode/codicons/dist/codicon.css";

import { App } from "./App";
import { initializeSafeArea } from "./safe-area";
import "./styles.css";
import { initializeTheme } from "./theme";

initializeSafeArea();
initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
