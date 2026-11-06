import { createHashRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import PromptStudio from "./pages/PromptStudio";
import GenerationQueue from "./pages/GenerationQueue";
import VideoLibrary from "./pages/VideoLibrary";
import ActivityHistory from "./pages/ActivityHistory";
import SettingsPage from "./pages/Settings";

/**
 * Hash router: in the packaged app the renderer is served from file://, so a
 * hash-based router keeps client-side routing working without any server-side
 * rewrites. (In dev, Vite serves the app the same way.)
 */
export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "accounts", element: <Accounts /> },
      { path: "prompts", element: <PromptStudio /> },
      { path: "queue", element: <GenerationQueue /> },
      { path: "videos", element: <VideoLibrary /> },
      { path: "activity", element: <ActivityHistory /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
