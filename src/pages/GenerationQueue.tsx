import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Circle,
  CircleCheck,
  XCircle,
  Clock,
  Filter,
  GripVertical,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge, EmptyState, Spinner } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import { fmtDateTime, JOB_STATUS_META, jobStatusLabel, preview } from "../lib/format";
import type { Account, GenerationJob, JobStatus } from "@shared/types";

const STATUS_FILTERS: (JobStatus | "all")[] = [
  "all",
  "draft",
  "pending",
  "ready",
  "generating",
  "completed",
  "failed",
  "paused",
  "cooldown",
];

/**
 * Generation Queue: manage the task pipeline. Each task tracks a prompt, an
 * account, and a status that moves through the user-confirmed workflow:
 * pending → ready → opened_in_gemini → generating → completed.
 * The app never auto-rotates accounts; cooldowns are user-recorded.
 */
export default function GenerationQueue() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const toast = useToasts((s) => s.push);

  async function reload() {
    setLoading(true);
    try {
      const [a, j] = await Promise.all([
        api.accountList(),
        api.jobList({
          status: statusFilter === "all" ? undefined : statusFilter,
          accountId: accountFilter === "all" ? undefined : accountFilter,
          search: search || undefined,
        }),
      ]);
      setAccounts(a);
      setJobs(j);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, accountFilter, search]);

  const accountLabel = (id: number | null) =>
    id ? accounts.find((a) => a.id === id)?.label ?? `#${id}` : "unassigned";

  async function advance(job: GenerationJob, next: JobStatus) {
    try {
      await api.jobSetStatus(job.id, next);
      toast("info", `Task #${job.id} → ${jobStatusLabel(next)}`);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function openInGemini(job: GenerationJob) {
    if (!job.account_id) {
      toast("error", "Assign an account to this task first.");
      return;
    }
    try {
      await api.jobSetStatus(job.id, "opened_in_gemini");
      const r = await api.openGemini(job.account_id);
      toast("success", `Opened ${r.url} in "${accountLabel(job.account_id)}".`);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function copyPrompt(job: GenerationJob) {
    try {
      await api.copyPrompt(job.prompt_text);
      toast("success", "Prompt copied to clipboard.");
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function pause() {
    // Pause every active task in the queue.
    const active = jobs.filter((j) =>
      ["pending", "ready", "opened_in_gemini", "awaiting_user_submission"].includes(j.status),
    );
    for (const j of active) {
      await api.jobSetStatus(j.id, "paused").catch(() => {});
    }
    toast("info", `Paused ${active.length} task(s).`);
    await reload();
  }

  async function resume() {
    const paused = jobs.filter((j) => j.status === "paused");
    for (const j of paused) {
      await api.jobSetStatus(j.id, "pending").catch(() => {});
    }
    toast("info", `Resumed ${paused.length} task(s).`);
    await reload();
  }

  async function retry(job: GenerationJob) {
    try {
      await api.jobSetStatus(job.id, "pending");
      toast("success", `Task #${job.id} reset to pending.`);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function cancel(job: GenerationJob) {
    if (!confirm(`Cancel task #${job.id}?`)) return;
    try {
      await api.jobSetStatus(job.id, "failed");
      toast("info", `Task #${job.id} cancelled.`);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function remove(job: GenerationJob) {
    if (!confirm(`Delete task #${job.id}? This cannot be undone.`)) return;
    try {
      await api.jobDelete(job.id);
      toast("success", "Task deleted.");
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function assignAccount(job: GenerationJob, accountId: number) {
    try {
      await api.jobUpdate(job.id, { account_id: accountId || null });
      toast("success", accountId ? "Account assigned." : "Account cleared.");
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  return (
    <div>
      <PageHeader
        title="Generation Queue"
        subtitle="Track each task from prompt to downloaded video. No automated account rotation — every step is user-confirmed."
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => void pause()} disabled={!jobs.length}>
          <Pause size={15} /> Pause Queue
        </button>
        <button className="btn-secondary" onClick={() => void resume()} disabled={!jobs.length}>
          <Play size={15} /> Resume Queue
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="input !w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
          >
            <option value="all">All statuses</option>
            {STATUS_FILTERS.filter((s) => s !== "all").map((s) => (
              <option key={s} value={s}>
                {jobStatusLabel(s)} ({counts[s] ?? 0})
              </option>
            ))}
          </select>
          <select
            className="input !w-44"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading queue…
        </div>
      ) : jobs.length ? (
        <div className="space-y-3">
          {jobs.map((j) => {
            const meta = JOB_STATUS_META[j.status];
            const tone =
              j.status === "completed"
                ? "success"
                : j.status === "failed"
                  ? "error"
                  : j.status === "generating"
                    ? "accent"
                    : j.status === "paused"
                      ? "neutral"
                      : j.status === "cooldown"
                        ? "warning"
                        : "info";
            return (
              <Card key={j.id} hover className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-ink-faint" />
                      <Badge tone={tone}>{jobStatusLabel(j.status)}</Badge>
                      <span className="text-xs text-ink-faint">#{j.id}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink">{preview(j.prompt_text, 120)}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Account: <span className="text-ink">{accountLabel(j.account_id)}</span> ·
                      created {fmtDateTime(j.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Account picker */}
                    <select
                      className="input !w-40 !py-1.5 text-xs"
                      value={j.account_id ?? ""}
                      onChange={(e) => void assignAccount(j, Number(e.target.value))}
                    >
                      <option value="">— assign account —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>

                    {j.status === "completed" ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CircleCheck size={14} /> done
                      </span>
                    ) : j.status === "failed" ? (
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => void retry(j)}>
                        <RotateCcw size={12} /> Retry
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => void openInGemini(j)}
                          disabled={!j.account_id}
                          title="Open Gemini in the assigned account profile"
                        >
                          <ExternalLink size={12} /> Open
                        </button>
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => void copyPrompt(j)}
                          title="Copy prompt to clipboard"
                        >
                          <Copy size={12} /> Copy
                        </button>
                        {j.status === "opened_in_gemini" || j.status === "awaiting_user_submission" ? (
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs text-accent"
                            onClick={() => void advance(j, "generating")}
                          >
                            <Play size={12} /> Mark Generating
                          </button>
                        ) : null}
                        {j.status === "generating" ? (
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs text-success"
                            onClick={() => void advance(j, "completed")}
                          >
                            <Check size={12} /> Mark Completed
                          </button>
                        ) : null}
                      </>
                    )}
                    <button
                      className="btn-ghost !p-1.5 text-error"
                      onClick={() => void remove(j)}
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {j.notes && (
                  <p className="mt-2 rounded bg-bg-soft px-3 py-1.5 text-xs text-ink-muted">
                    {j.notes}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Circle size={28} />}
          title="Queue is empty"
          hint="Add prompts from Prompt Studio, then assign accounts and open them in Gemini."
        />
      )}
    </div>
  );
}
