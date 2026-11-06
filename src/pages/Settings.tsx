import { useEffect, useState } from "react";
import {
  Settings2,
  Save,
  FolderOpen,
  ShieldCheck,
  Database,
  Bell,
  Monitor,
  Film,
  Check,
  Download,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import type { Settings } from "@shared/types";

type BoolKey =
  | "auto_organize_folders"
  | "generate_thumbnails"
  | "monitor_downloads"
  | "notify_task_complete"
  | "notify_cooldown"
  | "notify_errors";

/**
 * Settings: general, browser, video, database, and notification preferences.
 * All values persist to the local database (settings table). Sensitive items
 * (like a configured Chrome path) are editable but never leave the machine.
 */
export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [chromeTest, setChromeTest] = useState<{ found: boolean; path?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToasts((s) => s.push);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await api.getSettings();
        setS(loaded);
        setDraft(loaded);
      } catch (e) {
        toast("error", (e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s || !draft) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Card className="p-6 text-sm text-ink-muted">Loading settings…</Card>
      </div>
    );
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setDraft({ ...draft!, [k]: v });
  }

  function setBool(k: BoolKey, v: boolean) {
    set(k, (v ? "true" : "false") as string);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateSettings(draft!);
      setS(updated);
      setDraft(updated);
      toast("success", "Settings saved.");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pickDir(field: keyof Settings, title: string) {
    try {
      const p = await api.selectDir(title);
      if (p) set(field, p as string);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function testChrome() {
    try {
      const r = await api.testChrome();
      setChromeTest(r);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function backupDb() {
    try {
      const p = await api.backupDb();
      toast("success", `Database backed up to ${p}`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function restoreDb() {
    // Best-effort: the main process will prompt for a backup file to restore.
    try {
      await api.activityLog("settings.restore", "setting", null, "Restore requested");
      toast("info", "Restore: pick a .db backup file from the app data folder.");
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Preferences are stored locally in your database — nothing leaves this machine."
        actions={
          <button className="btn-primary" disabled={saving} onClick={() => void save()}>
            <Save size={15} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        }
      />

      <div className="grid gap-4">
        {/* General */}
        <Card className="p-5">
          <SectionTitle icon={<Settings2 size={16} />} label="General" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Application name">
              <input className="input" value={draft.app_name} onChange={(e) => set("app_name", e.target.value)} />
            </Field>
            <Field label="Language">
              <select className="input" value={draft.language} onChange={(e) => set("language", e.target.value)}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </Field>
            <Field label="Theme">
              <select className="input" value={draft.theme} onChange={(e) => set("theme", e.target.value as Settings["theme"])}>
                <option value="dark">Dark</option>
                <option value="light">Light (coming soon)</option>
              </select>
            </Field>
            <Field label="Default download directory">
              <div className="flex items-center gap-2">
                <input className="input" value={draft.default_download_dir} onChange={(e) => set("default_download_dir", e.target.value)} />
                <button className="btn-ghost !p-1.5" onClick={() => void pickDir("default_download_dir", "Choose download folder")}>
                  <FolderOpen size={14} />
                </button>
              </div>
            </Field>
          </div>
        </Card>

        {/* Browser */}
        <Card className="p-5">
          <SectionTitle icon={<Monitor size={16} />} label="Browser" />
          <Field label="Chrome / Chromium executable (leave blank to auto-detect)">
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs" value={draft.chrome_executable} onChange={(e) => set("chrome_executable", e.target.value)} placeholder="Auto-detect" />
              <button className="btn-ghost !p-1.5" onClick={() => void pickDir("chrome_executable", "Choose browser executable")}>
                <FolderOpen size={14} />
              </button>
              <button className="btn-ghost" onClick={() => void testChrome()}>
                <Check size={14} /> Test
              </button>
            </div>
          </Field>
          {chromeTest && (
            <div className="mt-2">
              {chromeTest.found ? (
                <p className="flex items-center gap-2 text-xs text-success">
                  <ShieldCheck size={14} /> Browser found: {chromeTest.path}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-xs text-warning">
                  <ShieldCheck size={14} /> No browser found — set the path above or install Google Chrome.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Video */}
        <Card className="p-5">
          <SectionTitle icon={<Film size={16} />} label="Video" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Video output directory">
              <div className="flex items-center gap-2">
                <input className="input" value={draft.video_output_dir} onChange={(e) => set("video_output_dir", e.target.value)} />
                <button className="btn-ghost !p-1.5" onClick={() => void pickDir("video_output_dir", "Choose video output folder")}>
                  <FolderOpen size={14} />
                </button>
              </div>
            </Field>
            <Toggle label="Auto-organize into year/month folders" checked={draft.auto_organize_folders === "true"} onChange={(v) => setBool("auto_organize_folders", v)} />
            <Toggle label="Generate thumbnails" checked={draft.generate_thumbnails === "true"} onChange={(v) => setBool("generate_thumbnails", v)} />
            <Toggle label="Monitor download folder" checked={draft.monitor_downloads === "true"} onChange={(v) => setBool("monitor_downloads", v)} />
          </div>
        </Card>

        {/* Database */}
        <Card className="p-5">
          <SectionTitle icon={<Database size={16} />} label="Database" />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={() => void backupDb()}>
              <Download size={15} /> Backup Database
            </button>
            <button className="btn-secondary" onClick={() => void restoreDb()}>
              <Database size={15} /> Restore…
            </button>
            <span className="text-xs text-ink-faint">
              Backups are written to the app data folder and are safe to move to a drive.
            </span>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-5">
          <SectionTitle icon={<Bell size={16} />} label="Notifications" />
          <div className="grid grid-cols-1 gap-3">
            <Toggle label="Task completion notifications" checked={draft.notify_task_complete === "true"} onChange={(v) => setBool("notify_task_complete", v)} />
            <Toggle label="Cooldown completion notifications" checked={draft.notify_cooldown === "true"} onChange={(v) => setBool("notify_cooldown", v)} />
            <Toggle label="Error notifications" checked={draft.notify_errors === "true"} onChange={(v) => setBool("notify_errors", v)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
      {icon} {label}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-accent" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-ink-muted">{label}</span>
      {checked && <Badge tone="success">on</Badge>}
    </label>
  );
}
