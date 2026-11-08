/**
 * Entry point for the Goob UI React application.
 * Sets up the root render with React StrictMode and BrowserRouter for client-side routing.
 * Imports settings early so the initial theme class is applied to the document before first paint.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./settings"; // Apply theme and window mode side effects on load

// Mount the app into the #root element provided by index.html
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
