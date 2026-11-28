// other
import ReactDOM from "react-dom/client";
import App from "./app/app";
import AppProvider from "./app/provider";
import "./index.css";
// before the app renders: Android's install prompt can fire at once, and is kept for Account → Appearance
import "./lib/install";
import { startServiceWorker } from "./lib/pwa/start";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <App />
  </AppProvider>
);

// the app shell for offline opens (docs/plans/offline.md, phase 2): a production build only
startServiceWorker();
