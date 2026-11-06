import { useEffect, useState } from "react";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, EmptyState, Spinner } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import { fmtDateTime } from "../lib/format";
import type { ActivityLog } from "@shared/types";

const PAGE_SIZE = 30;

/**
 * Activity History: a paginated, newest-first log of every significant action
 * the app has recorded (account CRUD, prompt saves, task transitions,
 * cooldowns, video imports, settings changes).
 */
export default function ActivityHistory() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const toast = useToasts((s) => s.push);

  async function load(reset = false) {
    const from = reset ? 0 : offset;
    setLoading(true);
    try {
      const rows = await api.activityList(PAGE_SIZE, from);
      // Client-side entity/action filter for quick narrowing.
      const f = filter.trim().toLowerCase();
      const filtered = f ? rows.filter((r) => r.action.toLowerCase().includes(f) || r.entity_type.toLowerCase().includes(f)) : rows;
      setLogs(filtered);
      setHasMore(rows.length === PAGE_SIZE && !f);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    setOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function pageAction(delta: number) {
    const next = Math.max(0, offset + delta * PAGE_SIZE);
    setOffset(next);
    void load();
  }

  const toneFor = (action: string) => {
    if (action.includes("created") || action.includes("imported")) return "text-success";
    if (action.includes("deleted") || action.includes("failed")) return "text-error";
    if (action.includes("cooldown")) return "text-warning";
    if (action.includes("completed")) return "text-success";
    return "text-ink";
  };

  return (
    <div>
      <PageHeader
        title="Activity History"
        subtitle="A running log of everything the app has done."
      />

      <div className="mb-4 flex items-center gap-3">
        <input
          className="input !w-64"
          placeholder="Filter by action or entity…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="ml-auto text-xs text-ink-faint">
          Newest first · {offset + 1}–{offset + logs.length}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading activity…
        </div>
      ) : logs.length ? (
        <Card className="divide-y divide-line">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-3.5">
              <History size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${toneFor(l.action)}`}>{l.action}</span>
                  <span className="badge bg-white/5 text-ink-faint">
                    {l.entity_type}
                    {l.entity_id && l.entity_id !== "0" ? `:${l.entity_id}` : ""}
                  </span>
                </div>
                {l.description && (
                  <p className="mt-0.5 truncate text-sm text-ink-muted" title={l.description}>
                    {l.description}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-ink-faint">{fmtDateTime(l.created_at)}</p>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState
          icon={<History size={28} />}
          title="No activity yet"
          hint="Actions you take across the app will be recorded here."
        />
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          className="btn-secondary !px-3 !py-1.5 text-xs"
          disabled={offset === 0}
          onClick={() => pageAction(-1)}
        >
          <ChevronLeft size={14} /> Newer
        </button>
        <button
          className="btn-secondary !px-3 !py-1.5 text-xs"
          disabled={!hasMore}
          onClick={() => pageAction(1)}
        >
          Older <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
