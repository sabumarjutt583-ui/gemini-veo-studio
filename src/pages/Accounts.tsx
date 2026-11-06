import { useEffect, useState } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  FolderOpen,
  Pause,
  CheckCircle2,
  TimerOff,
  User,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge, Modal, EmptyState, Spinner } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import { accountDisplayStatus, fmtDateTime, fmtCountdown } from "../lib/format";
import { useCountdown } from "../hooks/useCountdown";
import type { Account, AccountType, UsageStatus, Cooldown, CooldownType } from "@shared/types";

type FormState = {
  label: string;
  email: string;
  account_type: AccountType;
};

/**
 * Google Accounts: add / edit / delete account profiles, each with its own
 * Chrome user-data directory. The app never touches Google credentials; it
 * only records the profile path and a user-maintained usage status.
 */
export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cooldowns, setCooldowns] = useState<Cooldown[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToasts((s) => s.push);

  // Editor state.
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({
    label: "",
    email: "",
    account_type: "pro",
  });

  // Usage status edit.
  const [usageFor, setUsageFor] = useState<Account | null>(null);
  const [cooldownFor, setCooldownFor] = useState<Account | null>(null);
  const [cooldownForm, setCooldownForm] = useState<{
    type: CooldownType;
    resetTime: string;
    notes: string;
  }>({
    type: "five_hour",
    resetTime: "",
    notes: "",
  });

  async function reload() {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([api.accountList(), api.cooldownList()]);
      setAccounts(a);
      setCooldowns(c);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setEditing(null);
    setForm({ label: "", email: "", account_type: "pro" });
    setCreating(true);
  }

  function startEdit(a: Account) {
    setCreating(false);
    setEditing(a);
    setForm({ label: a.label, email: a.email ?? "", account_type: a.account_type });
  }

  async function submit() {
    const payload = {
      label: form.label.trim(),
      email: form.email.trim() || null,
      account_type: form.account_type,
    };
    if (!payload.label) {
      toast("error", "Account label is required.");
      return;
    }
    try {
      if (editing) {
        await api.accountUpdate(editing.id, {
          label: payload.label,
          email: payload.email,
          account_type: payload.account_type,
        });
        toast("success", "Account updated.");
      } else {
        await api.accountCreate({
          label: payload.label,
          email: payload.email,
          account_type: payload.account_type,
        });
        toast("success", "Account created with its own browser profile.");
      }
      setCreating(false);
      setEditing(null);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function remove(a: Account) {
    if (
      !confirm(
        `Delete account "${a.label}"? Its browser profile stays on disk unless you also remove it.`,
      )
    )
      return;
    try {
      await api.accountDelete(a.id);
      toast("success", "Account deleted.");
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function openGemini(a: Account) {
    try {
      const r = await api.openGemini(a.id);
      toast("info", `Opened ${r.url} in the "${a.label}" profile.`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function revealProfile(a: Account) {
    try {
      const r = await api.openProfile(a.id);
      toast("info", `Profile: ${r.path}`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function setUsage(a: Account, usage: UsageStatus) {
    try {
      await api.accountSetUsage(a.id, usage);
      toast("success", `Account marked ${usage}.`);
      setUsageFor(null);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function startCooldown() {
    if (!cooldownFor) return;
    const resetTime = cooldownForm.resetTime || null;
    try {
      await api.cooldownCreate({
        account_id: cooldownFor.id,
        cooldown_type: cooldownForm.type,
        reset_time: resetTime,
        notes: cooldownForm.notes || null,
      });
      toast("success", "Cooldown recorded. The account is now flagged.");
      setCooldownFor(null);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  const activeByAccount = (id: number) =>
    cooldowns.find((c) => c.account_id === id && c.status === "active");

  return (
    <div>
      <PageHeader
        title="Google Accounts"
        subtitle="Each account gets its own Chrome profile. Sign in manually in the browser — the app never sees your password."
        actions={
          <button className="btn-primary" onClick={startCreate}>
            <Plus size={15} /> Add Account
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading accounts…
        </div>
      ) : accounts.length ? (
        <div className="grid gap-4">
          {accounts.map((a) => {
            const st = accountDisplayStatus(a);
            const cd = activeByAccount(a.id);
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <User size={16} className="text-ink-faint" />
                      <h3 className="font-semibold text-ink">{a.label}</h3>
                      <Badge tone={a.account_type === "pro" ? "accent" : "neutral"}>
                        {a.account_type === "pro" ? "Pro" : a.account_type === "free" ? "Free" : "Other"}
                      </Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {a.email || "email not set"}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-ink-faint" title={a.browser_profile_path}>
                      {a.browser_profile_path}
                    </p>

                    {cd && (
                      <CooldownChip
                        cd={cd}
                        onClear={async () => {
                          try {
                            await api.cooldownClear(cd.id);
                            toast("success", "Cooldown cleared.");
                            await reload();
                          } catch (e) {
                            toast("error", (e as Error).message);
                          }
                        }}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-secondary !py-1.5" onClick={() => void openGemini(a)}>
                      <ExternalLink size={14} /> Open Gemini
                    </button>
                    <button className="btn-ghost !py-1.5" onClick={() => void revealProfile(a)}>
                      <FolderOpen size={14} /> Profile
                    </button>
                    <button className="btn-ghost !py-1.5" onClick={() => startEdit(a)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn-ghost !py-1.5" onClick={() => setCooldownFor(a)}>
                      <TimerOff size={14} /> Cooldown
                    </button>
                    <button
                      className="btn-ghost !py-1.5 text-error"
                      onClick={() => void remove(a)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span className="text-xs text-ink-faint">Mark status:</span>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => void setUsage(a, "ready")}
                  >
                    <CheckCircle2 size={12} /> Ready
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => void setUsage(a, "cooldown")}
                  >
                    <Pause size={12} /> Cooldown
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => setUsageFor(a)}
                  >
                    Change…
                  </button>
                  <span className="ml-auto text-xs text-ink-faint">
                    Updated {fmtDateTime(a.updated_at)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<User size={28} />}
          title="No accounts yet"
          hint="Create your first account. It will be given its own browser profile automatically."
          action={
            <button className="btn-primary" onClick={startCreate}>
              <Plus size={15} /> Add Account
            </button>
          }
        />
      )}

      {/* Create / edit modal */}
      {(creating || editing) && (
        <Modal
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          title={editing ? `Edit ${editing.label}` : "New Account"}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Label *</label>
              <input
                className="input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Personal Pro"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@gmail.com"
                type="email"
              />
              <p className="mt-1 text-xs text-ink-faint">
                Not used for sign-in. We never collect or store Google passwords.
              </p>
            </div>
            <div>
              <label className="label">Account type</label>
              <select
                className="input"
                value={form.account_type}
                onChange={(e) =>
                  setForm({ ...form, account_type: e.target.value as AccountType })
                }
              >
                <option value="pro">Pro (AI Pro)</option>
                <option value="free">Free</option>
                <option value="other">Other</option>
              </select>
            </div>
            {editing && (
              <div>
                <label className="label">Browser profile path</label>
                <input
                  className="input font-mono text-xs"
                  value={editing.browser_profile_path}
                  readOnly
                />
                <p className="mt-1 text-xs text-ink-faint">
                  This path is provisioned automatically. To change it, delete and re-add the account.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void submit()}>
                {editing ? "Save" : "Create Account"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Usage status modal */}
      {usageFor && (
        <Modal open onClose={() => setUsageFor(null)} title={`Usage status — ${usageFor.label}`}>
          <div className="space-y-2">
            {(["ready", "busy", "cooldown", "weekly_limit", "none"] as UsageStatus[]).map((u) => (
              <button
                key={u}
                className="btn-secondary w-full justify-between"
                onClick={() => void setUsage(usageFor, u)}
              >
                <span className="capitalize">{u.replace("_", " ")}</span>
                {usageFor.usage_status === u && <Badge tone="success">current</Badge>}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Cooldown modal */}
      {cooldownFor && (
        <Modal open onClose={() => setCooldownFor(null)} title={`Record cooldown — ${cooldownFor.label}`}>
          <div className="space-y-4">
            <div>
              <label className="label">Cooldown type</label>
              <select
                className="input"
                value={cooldownForm.type}
                onChange={(e) => setCooldownForm({ ...cooldownForm, type: e.target.value as CooldownType })}
              >
                <option value="five_hour">Five-hour window</option>
                <option value="weekly">Weekly limit</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="label">Expected reset time</label>
              <input
                type="datetime-local"
                className="input"
                value={cooldownForm.resetTime}
                onChange={(e) => setCooldownForm({ ...cooldownForm, resetTime: e.target.value })}
              />
              <p className="mt-1 text-xs text-ink-faint">
                When set, the app shows a countdown and reminds you when it ends.
              </p>
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                className="input"
                value={cooldownForm.notes}
                onChange={(e) => setCooldownForm({ ...cooldownForm, notes: e.target.value })}
                placeholder="e.g. hit weekly limit on 2nd batch"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setCooldownFor(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void startCooldown()}>
                Record Cooldown
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Compact chip showing an active cooldown with a live countdown. */
function CooldownChip({ cd, onClear }: { cd: Cooldown; onClear: () => void }) {
  const { seconds } = useCountdown(cd.reset_time ?? undefined);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5 text-sm text-warning">
      <TimerOff size={14} />
      {cd.reset_time ? (
        <span>
          Cooldown until {fmtDateTime(cd.reset_time)} ·{" "}
          <span className="font-mono">{fmtCountdown(seconds)}</span>
        </span>
      ) : (
        <span>On cooldown (no reset time set)</span>
      )}
      <button className="ml-auto text-xs underline" onClick={onClear}>
        clear
      </button>
    </div>
  );
}
