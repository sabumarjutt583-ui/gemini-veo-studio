/**
 * Small reusable UI primitives shared across all pages. Kept dependency-free
 * (only React + Tailwind classes) so the design system stays consistent.
 */
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>
  );
}

/** Status badge with a semantic tone. */
export function Badge({
  tone = "neutral",
  children,
  pulse = false,
}: {
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "accent";
  children: ReactNode;
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-ink-muted",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    error: "bg-error/15 text-error",
    info: "bg-accent/15 text-accent",
    accent: "bg-accent/15 text-accent",
  };
  const dot: Record<string, string> = {
    neutral: "bg-ink-faint",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
    info: "bg-accent",
    accent: "bg-accent",
  };
  return (
    <span className={`badge ${tones[tone]}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${dot[tone]} ${pulse ? "animate-pulse-ring" : ""}`}
      />
      {children}
    </span>
  );
}

/** Modal dialog. Closes on backdrop click + Escape. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} card p-5 animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="btn-ghost !p-1.5 !px-1.5 text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <div>
        <p className="font-medium text-ink">{title}</p>
        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
      role="status"
      aria-label="Loading"
    />
  );
}
