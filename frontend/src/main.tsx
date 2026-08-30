import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App"; // Vite resolves .tsx automatically
import "./index.css";
import "./App.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
