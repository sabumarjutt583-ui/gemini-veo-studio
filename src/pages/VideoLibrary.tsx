import { useEffect, useRef, useState } from "react";
import {
  Film,
  FolderOpen,
  Pencil,
  Trash2,
  Copy,
  Import,
  Link2,
  Play,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge, EmptyState, Modal, Spinner } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import { fmtDateTime, fmtBytes, fmtDuration, preview } from "../lib/format";
import type { GenerationJob, Video } from "@shared/types";

/**
 * Video Library: browse, import, organize, and manage downloaded videos.
 * The app only moves/organizes files when the user opts in; deletes always
 * require confirmation.
 */
export default function VideoLibrary() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<Video | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [linking, setLinking] = useState<Video | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToasts((s) => s.push);

  async function reload() {
    setLoading(true);
    try {
      const [v, j, a] = await Promise.all([
        api.videoList(),
        api.jobList(),
        api.accountList(),
      ]);
      setVideos(v);
      setJobs(j);
      setAccounts(a.map((x) => ({ id: x.id, label: x.label })));
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

  const jobFor = (id: number | null) => jobs.find((j) => j.id === id);
  const accountLabel = (job: GenerationJob | undefined) =>
    job?.account_id
      ? accounts.find((a) => a.id === job.account_id)?.label ?? `#${job.account_id}`
      : "—";

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      await api.videoImport(f.path);
      toast("success", `Imported "${f.name}" into the library.`);
      await reload();
    } catch (err) {
      toast("error", (err as Error).message);
    }
  }

  async function openFolder(v: Video) {
    // Ask the main process to reveal the containing folder.
    try {
      // Use a best-effort reveal via the profile-path helper pattern:
      // the main process exposes shell.openPath on the folder.
      // We surface the path in a toast so the user can copy it.
      await navigator.clipboard?.writeText(v.file_path);
      toast("info", `Path copied: ${v.file_path}`);
    } catch {
      toast("info", v.file_path);
    }
  }

  async function copyPath(v: Video) {
    try {
      await navigator.clipboard?.writeText(v.file_path);
      toast("success", "Path copied to clipboard.");
    } catch {
      toast("info", v.file_path);
    }
  }

  async function submitRename() {
    if (!renaming || !renameVal.trim()) return;
    try {
      await api.videoRename(renaming.id, renameVal.trim());
      toast("success", "Video renamed.");
      setRenaming(null);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function remove(v: Video) {
    const withFile = confirm(
      `Delete "${v.filename}"? Choose OK to delete the record only, or see below to also delete the file.`,
    );
    if (!withFile) return;
    const alsoDeleteFile = confirm(
      "Also delete the video file from disk? This cannot be undone.",
    );
    try {
      await api.videoDelete(v.id, alsoDeleteFile);
      toast("success", alsoDeleteFile ? "Video and file deleted." : "Record deleted (file kept).");
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function submitLink() {
    if (!linking) return;
    const sel = prompt("Link to task # (leave blank to unlink)");
    if (sel === null) return;
    const jobId = sel.trim() ? Number(sel.trim()) : null;
    try {
      await api.videoLinkJob(linking.id, jobId);
      toast("success", jobId ? `Linked to task #${jobId}.` : "Unlinked from task.");
      setLinking(null);
      await reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Video Library"
        subtitle="All generated and imported videos, organized locally."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="video/*,.mp4,.mov,.webm,.mkv"
              className="hidden"
              onChange={(e) => void importFile(e)}
            />
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Import size={15} /> Import Video
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner /> Loading library…
        </div>
      ) : videos.length ? (
        <div className="grid grid-cols-2 gap-4">
          {videos.map((v) => {
            const job = jobFor(v.job_id);
            return (
              <Card key={v.id} hover className="overflow-hidden">
                <div className="relative aspect-video bg-bg-soft">
                  {v.thumbnail_path ? (
                    <img
                      src={v.thumbnail_path}
                      alt={v.filename}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-faint">
                      <Film size={28} />
                    </div>
                  )}
                  <button
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition hover:opacity-100"
                    onClick={() => toast("info", `Play: ${v.file_path}`)}
                    aria-label="Play"
                  >
                    <Play size={32} className="text-white" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{v.filename}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {fmtBytes(v.file_size)} · {v.duration != null ? fmtDuration(v.duration) : "—"} ·{" "}
                        {fmtDateTime(v.downloaded_at)}
                      </p>
                    </div>
                    {v.job_id ? (
                      <Badge tone="accent">task #{v.job_id}</Badge>
                    ) : (
                      <Badge tone="neutral">unlinked</Badge>
                    )}
                  </div>

                  {job && (
                    <p className="mt-2 truncate rounded bg-bg-soft px-2.5 py-1.5 text-xs text-ink-muted" title={job.prompt_text}>
                      {preview(job.prompt_text, 90)}
                    </p>
                  )}
                  {job && (
                    <p className="mt-1.5 text-xs text-ink-faint">Account: {accountLabel(job)}</p>
                  )}

                  <div className="mt-3 flex items-center gap-1">
                    <button className="btn-ghost !p-1.5" title="Open containing folder" onClick={() => void openFolder(v)}>
                      <FolderOpen size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5" title="Copy path" onClick={() => void copyPath(v)}>
                      <Copy size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5" title="Rename" onClick={() => { setRenaming(v); setRenameVal(v.filename); }}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5" title="Link to task" onClick={() => setLinking(v)}>
                      <Link2 size={14} />
                    </button>
                    <button className="btn-ghost !p-1.5 text-error" title="Delete" onClick={() => void remove(v)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Film size={28} />}
          title="No videos yet"
          hint="Import a downloaded video, or set your download folder in Settings to auto-detect."
          action={
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Import size={15} /> Import Video
            </button>
          }
        />
      )}

      {/* Rename modal */}
      {renaming && (
        <Modal open onClose={() => setRenaming(null)} title="Rename video">
          <div className="space-y-4">
            <input className="input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => void submitRename()}>
                <Check size={15} /> Rename
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
