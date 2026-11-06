import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToasts, type ToastKind } from "../../stores/toast";

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLE: Record<ToastKind, string> = {
  success: "border-success/40 text-success",
  error: "border-error/40 text-error",
  info: "border-accent/40 text-accent",
};

/** Fixed toast stack (bottom-right). Driven by the toasts zustand store. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className={`card flex items-start gap-3 border p-3 shadow-card animate-slide-up ${STYLE[t.kind]}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-faint hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
