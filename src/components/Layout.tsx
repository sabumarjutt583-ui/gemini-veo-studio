import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PenLine,
  ListOrdered,
  Film,
  History,
  Settings,
  Sparkles,
} from "lucide-react";
import { Toasts } from "./ui/toasts";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/accounts", label: "Google Accounts", icon: Users },
  { to: "/prompts", label: "Prompt Studio", icon: PenLine },
  { to: "/queue", label: "Generation Queue", icon: ListOrdered },
  { to: "/videos", label: "Video Library", icon: Film },
  { to: "/activity", label: "Activity History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

/**
 * App shell: fixed sidebar (navigation + brand) and a scrolling content pane.
 * Every page renders inside <Outlet/> through the router.
 */
export function Layout() {
  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-sidebar">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-glow">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">Gemini Veo Studio</p>
            <p className="text-xs text-ink-faint">Multi-account manager</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-accent-soft text-ink"
                    : "text-ink-muted hover:bg-white/5 hover:text-ink"
                }`
              }
            >
              <item.icon size={17} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4 text-xs text-ink-faint">
          <p>Gemini Veo Studio</p>
          <p className="mt-0.5">v1.0.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <Outlet />
        </div>
      </main>

      <Toasts />
    </div>
  );
}
