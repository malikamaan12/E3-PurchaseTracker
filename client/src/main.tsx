import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/contexts/ToastContext";
import App from './App';
import "./index.css";
import "./styles/bento-liquid.css"; // Import bento liquid animation styles

// Ensure toast notifications work properly by setting up providers correctly
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);