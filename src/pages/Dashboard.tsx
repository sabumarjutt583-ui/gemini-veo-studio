import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  PenLine,
  Film,
  CircleCheck,
  Clock,
  CircleAlert,
  Plus,
  ExternalLink,
  Sparkles,
  ListOrdered,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge, EmptyState } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import {
  accountDisplayStatus,
  fmtDateTime,
  preview,
} from "../lib/format";
import type { Account, GenerationJob, Video, DashboardStats } from "@shared/types";

/**
 * Dashboard: high-level stats, recent activity across accounts/tasks/videos,
 * and quick actions. All data comes from the main process through window.api.
 */
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const toast = useToasts((s) => s.push);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, a, j, v] = await Promise.all([
          api.getStats(),
          api.accountList(),
          api.jobList({ limit: 5 }),
          api.videoList(),
        ]);
        if (!live) return;
        setStats(s);
        setAccounts(a);
        setJobs(j);
        setVideos(v.slice(0, 6));
      } catch (e) {
        toast("error", (e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [toast]);

  const statCards = [
    { label: "Google Accounts", value: stats?.total_accounts, icon: Users, tone: "text-accent" },
    { label: "Connected", value: stats?.connected_accounts, icon: CircleCheck, tone: "text-success" },
    { label: "Ready", value: stats?.ready_accounts, icon: CircleCheck, tone: "text-success" },
    { label: "On Cooldown", value: stats?.cooldown_accounts, icon: Clock, tone: "text-warning" },
    { label: "Prompts", value: stats?.total_prompts, icon: PenLine, tone: "text-ink" },
    { label: "Completed Tasks", value: stats?.completed_tasks, icon: CircleCheck, tone: "text-success" },
    { label: "Pending Tasks", value: stats?.pending_tasks, icon: Clock, tone: "text-info" },
    { label: "Failed Tasks", value: stats?.failed_tasks, icon: CircleAlert, tone: "text-error" },
    { label: "Downloaded Videos", value: stats?.downloaded_videos, icon: Film, tone: "text-ink" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your accounts, prompts, and generation activity."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">{s.label}</p>
              <s.icon size={16} className={s.tone} />
            </div>
            <p className={`mt-2 text-2xl font-semibold ${s.tone}`}>
              {s.value ?? 0}
            </p>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/accounts" className="btn-primary">
          <Plus size={15} /> Add Google Account
        </Link>
        <Link to="/prompts" className="btn-secondary">
          <PenLine size={15} /> New Prompt
        </Link>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              const c = await api.testChrome();
              if (c.found) toast("success", `Browser ready: ${c.path}`);
              else toast("info", "No browser found — set the path in Settings.");
            } catch (e) {
              toast("error", (e as Error).message);
            }
          }}
        >
          <ExternalLink size={15} /> Open Gemini
        </button>
        <Link to="/queue" className="btn-secondary">
          <ListOrdered size={15} /> Generation Queue
        </Link>
        <Link to="/videos" className="btn-secondary">
          <Film size={15} /> Video Library
        </Link>
      </div>

      {/* Account overview */}
      <section className="mt-8">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Users size={16} /> Google Accounts
        </h2>
        {accounts.length ? (
          <div className="grid gap-3">
            {accounts.map((a) => {
              const st = accountDisplayStatus(a);
              return (
                <Card key={a.id} hover className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{a.label}</span>
                      <Badge tone={a.account_type === "pro" ? "accent" : "neutral"}>
                        {a.account_type === "pro" ? "Pro" : a.account_type === "free" ? "Free" : "Other"}
                      </Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {a.email || "no email set"} · last updated {fmtDateTime(a.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to="/accounts" className="btn-ghost !px-2 !py-1 text-xs">
                      Manage
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={28} />}
            title="No accounts yet"
            hint="Add your first Google account to begin."
            action={
              <Link to="/accounts" className="btn-primary">
                <Plus size={15} /> Add Account
              </Link>
            }
          />
        )}
      </section>

      {/* Recent tasks */}
      <section className="mt-8">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Sparkles size={16} /> Recent Generation Tasks
        </h2>
        {jobs.length ? (
          <Card className="divide-y divide-line">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{preview(j.prompt_text)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    #{j.id} · created {fmtDateTime(j.created_at)}
                  </p>
                </div>
                <Badge
                  tone={
                    j.status === "completed"
                      ? "success"
                      : j.status === "failed"
                        ? "error"
                        : j.status === "generating"
                          ? "accent"
                          : "info"
                  }
                >
                  {j.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={<ListOrdered size={28} />}
            title="No tasks yet"
            hint="Queue a prompt to start generating."
            action={
              <Link to="/queue" className="btn-primary">
                <Plus size={15} /> Open Queue
              </Link>
            }
          />
        )}
      </section>

      {/* Recent videos */}
      <section className="mt-8">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Film size={16} /> Recent Videos
        </h2>
        {videos.length ? (
          <div className="grid grid-cols-3 gap-3">
            {videos.map((v) => (
              <Card key={v.id} hover className="overflow-hidden">
                <div className="aspect-video bg-bg-soft">
                  {v.thumbnail_path ? (
                    <img src={v.thumbnail_path} alt={v.filename} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-faint">
                      <Film size={24} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink">{v.filename}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{fmtDateTime(v.downloaded_at)}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Film size={28} />}
            title="No videos yet"
            hint="Import a video when a generation completes."
            action={
              <Link to="/videos" className="btn-secondary">
                <Film size={15} /> Video Library
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
