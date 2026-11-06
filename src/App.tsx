/**
 * App entry component. Kept minimal: it renders the routed layout (which owns
 * the sidebar + toasts) and is the single mount point if global providers are
 * ever needed later.
 */
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export default function App() {
  return <RouterProvider router={router} />;
}
