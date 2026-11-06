import { Notification } from "electron";
import type { Repositories } from "../database/repositories";
import type { CooldownNotification } from "./cooldown.service";

/**
 * Desktop notifications. Kept as a thin wrapper so the services never import
 * `electron` directly — they talk to a `Notifier` interface and the main
 * process binds it to Electron's `Notification`. In tests a no-op or spy
 * Notifier is injected instead.
 */
export interface Notifier {
  show(title: string, body: string, opts?: { silent?: boolean }): void;
}

export class NotificationService implements Notifier {
  constructor(private readonly repos: Repositories, private readonly settingsRead?: () => { notify_task_complete?: string; notify_cooldown?: string; notify_errors?: string }) {}

  /** Electron implementation — safe to call from the main process only. */
  static electron(): Notifier {
    return {
      show(title: string, body: string) {
        const n = new Notification({ title, body });
        n.show();
      },
    };
  }

  show(title: string, body: string): void {
    // Electron's Notification must only be constructed on the main process and
    // only after app is ready. Guard against it being unavailable.
    try {
      NotificationService.electron().show(title, body);
    } catch {
      /* notifications are best-effort; a failure here must not break the app */
    }
  }

  taskComplete(jobId: number, label: string): void {
    if (this.shouldNotify("notify_task_complete")) this.show("Task completed", `${label} finished generating.`);
  }

  cooldownEnded(n: CooldownNotification): void {
    if (this.shouldNotify("notify_cooldown")) {
      this.show("Cooldown ended", `${n.accountLabel}: ${n.note}`);
    }
  }

  error(title: string, body: string): void {
    if (this.shouldNotify("notify_errors")) this.show(title, body);
  }

  private shouldNotify(key: "notify_task_complete" | "notify_cooldown" | "notify_errors"): boolean {
    try {
      const s = this.settingsRead?.() ?? {};
      return s[key] !== "false";
    } catch {
      return true;
    }
  }
}

export class NoopNotifier implements Notifier {
  show(): void {}
}
