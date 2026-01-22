import React from "react";

// other
import ReactDOM from "react-dom/client";
import App from "./app/app";
import AppProvider from "./app/provider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);




