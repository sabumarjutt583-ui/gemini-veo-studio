import type { Repositories } from "../database/repositories";
import type { Cooldown, CooldownType, NewCooldown } from "@shared/types";

/**
 * Cooldown / usage-limit tracking. All of this is USER-RECORDED: the user
 * marks an account as cooling down, optionally records the expected reset time,
 * and the app computes the countdown. The app never invents or reads Google's
 * private quota — it only manages what the user explicitly recorded.
 *
 * A `NotificationSink` is injected so expiry notifications can be produced
 * without the service importing Electron directly (keeps it unit-testable).
 */
export interface CooldownNotification {
  cooldownId: number;
  accountId: number;
  accountLabel: string;
  resetTime: string | null;
  note: string;
}

export type NotificationSink = (n: CooldownNotification) => void;

export interface CooldownInfo {
  cooldown: Cooldown | null;
  accountLabel: string | null;
  secondsRemaining: number; // 0 if no active reset time
}

export class CooldownService {
  private notify?: NotificationSink;
  constructor(
    private readonly repos: Repositories,
    notify?: NotificationSink
  ) {
    this.notify = notify;
  }

  setNotifier(sink: NotificationSink): void {
    this.notify = sink;
  }

  list(accountId?: number): Cooldown[] {
    return this.repos.cooldowns.list(accountId);
  }

  activeFor(accountId: number): Cooldown | null {
    return this.repos.cooldowns.activeFor(accountId);
  }

  /** Record a cooldown event for an account and flag the account accordingly. */
  create(input: NewCooldown): Cooldown {
    const cooldown = this.repos.cooldowns.create(input);
    // Reflect the restriction on the account's usage status.
    this.repos.accounts.setUsage(input.account_id, "cooldown");
    this.repos.activity.log({
      action: "cooldown.created",
      entity_type: "cooldown",
      entity_id: String(cooldown.id),
      description: this.describe(cooldown),
    });
    return cooldown;
  }

  /** Mark a cooldown cleared and return the account to a neutral status. */
  clear(id: number): Cooldown {
    const cooldown = this.repos.cooldowns.get(id);
    if (!cooldown) throw new Error(`Cooldown ${id} not found`);
    const cleared = this.repos.cooldowns.clear(id);
    if (!cleared) throw new Error(`Cooldown ${id} not found`);
    // If no other active cooldown remains, reset the account's usage flag.
    if (!this.repos.cooldowns.activeFor(cooldown.account_id)) {
      this.repos.accounts.setUsage(cooldown.account_id, "ready");
    }
    this.repos.activity.log({
      action: "cooldown.cleared",
      entity_type: "cooldown",
      entity_id: String(id),
      description: `Cleared cooldown for account ${cooldown.account_id}`,
    });
    return cleared;
  }

  /**
   * Compute how long remains until the account's active cooldown resets.
   * Returns 0 when there is no active cooldown or no recorded reset time.
   */
  secondsRemaining(accountId: number): number {
    const active = this.repos.cooldowns.activeFor(accountId);
    if (!active || !active.reset_time) return 0;
    const reset = new Date(active.reset_time).getTime();
    const now = Date.now();
    if (isNaN(reset) || reset <= now) return 0;
    return Math.round((reset - now) / 1000);
  }

  /** Info payload used by the dashboard countdown widget. */
  infoFor(accountId: number): CooldownInfo {
    const account = this.repos.accounts.get(accountId);
    const active = this.repos.cooldowns.activeFor(accountId);
    return {
      cooldown: active,
      accountLabel: account?.label ?? null,
      secondsRemaining: active ? this.secondsRemaining(accountId) : 0,
    };
  }

  /**
   * Check for expired cooldowns (reset_time in the past) and emit a
   * notification for each. Returns the ids of those just notified. Call this
   * on a periodic timer from the main process.
   */
  checkExpired(): number[] {
    const notified: number[] = [];
    for (const cd of this.repos.cooldowns.list()) {
      if (cd.status !== "active" || !cd.reset_time) continue;
      if (new Date(cd.reset_time).getTime() > Date.now()) continue;
      const account = this.repos.accounts.get(cd.account_id);
      this.notify?.({
        cooldownId: cd.id,
        accountId: cd.account_id,
        accountLabel: account?.label ?? `account ${cd.account_id}`,
        resetTime: cd.reset_time,
        note: `Cooldown for ${account?.label ?? "account"} has ended — verify before use.`,
      });
      notified.push(cd.id);
      // Leave it active so the user still has to explicitly clear it.
    }
    return notified;
  }

  /** Default durations (ms) used when the user picks a preset type. */
  static presetMs(type: CooldownType): number {
    switch (type) {
      case "five_hour":
        return 5 * 60 * 60 * 1000;
      case "weekly":
        return 7 * 24 * 60 * 60 * 1000;
      case "custom":
        return 0;
    }
  }

  private describe(c: Cooldown): string {
    const reset = c.reset_time ? ` (resets ${c.reset_time})` : "";
    return `Cooldown ${c.cooldown_type} on account ${c.account_id}${reset}`;
  }
}
