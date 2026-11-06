import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Copy,
  ListPlus,
  Search,
  Upload,
  FileText,
  PenLine,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card, Badge, Modal, EmptyState, Spinner } from "../components/ui/primitives";
import { useToasts } from "../stores/toast";
import { fmtDateTime, preview } from "../lib/format";
import type { Prompt } from "@shared/types";

/**
 * Prompt Studio: a large editor for authoring a video prompt, plus a library
 * of saved prompts and bulk import from TXT/CSV files.
 */
export default function PromptStudio() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [library, setLibrary] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToasts((s) => s.push);

  async function reload(q?: string) {
    setLoading(true);
    try {
      setLibrary(await api.promptList(q));
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

  async function save() {
    if (!text.trim()) {
      toast("error", "Enter a prompt before saving.");
      return;
    }
    try {
      await api.promptCreate({
        title: title.trim() || "Untitled",
        prompt_text: text,
        category: category.trim() || null,
      });
      setText("");
      setTitle("");
      setCategory("");
      toast("success", "Prompt saved to the library.");
      await reload(search);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function addToQueue() {
    if (!text.trim()) {
      toast("error", "Enter a prompt first.");
      return;
    }
    try {
      const created = await api.promptCreate({
        title: title.trim() || "Untitled",
        prompt_text: text,
        category: category.trim() || null,
      });
      await api.jobCreate({
        prompt_id: created.id,
        prompt_text: created.prompt_text,
      });
      toast("success", "Saved and added to the generation queue.");
      setText("");
      setTitle("");
      setCategory("");
      await reload(search);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function copy() {
    try {
      await api.copyPrompt(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function openForEdit(p: Prompt) {
    setEditing(p);
    setText(p.prompt_text);
    setTitle(p.title);
    setCategory(p.category ?? "");
  }

  async function updateEditing() {
    if (!editing) return;
    try {
      await api.promptUpdate(editing.id, {
        title: title.trim() || editing.title,
        prompt_text: text,
        category: category.trim() || null,
      });
      setEditing(null);
      toast("success", "Prompt updated.");
      await reload(search);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function remove(p: Prompt) {
    if (!confirm(`Delete prompt "${p.title}"?`)) return;
    try {
      await api.promptDelete(p.id);
      toast("success", "Prompt deleted.");
      await reload(search);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function duplicate(p: Prompt) {
    try {
      await api.promptCreate({
        title: p.title + " (copy)",
        prompt_text: p.prompt_text,
        category: p.category,
      });
      toast("success", "Prompt duplicated.");
      await reload(search);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  /** Pick a file, let the main process read it, then import. */
  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    // The renderer cannot read an arbitrary local path directly; it hands the
    // picked file's path to the main process via IPC.
    const format: "txt" | "csv" = f.name.toLowerCase().endsWith(".csv") ? "csv" : "txt";
    try {
      const created = await api.promptImportFile(f.path, format);
      toast("success", `Imported ${created.length} prompt(s) from ${f.name}.`);
      await reload(search);
    } catch (err) {
      toast("error", (err as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Prompt Studio"
        subtitle="Author, save, and queue video-generation prompts. Bulk import supported."
      />

      {/* Editor */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">{editing ? "Editing" : "New Prompt"}</h2>
          <Badge tone="neutral">{text.length} chars</Badge>
        </div>
        <textarea
          className="input min-h-[140px] resize-y font-mono text-sm leading-relaxed"
          placeholder="Describe the video you want to generate…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="input"
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <button className="btn-primary" onClick={() => void updateEditing()}>
              <Save size={15} /> Save Changes
            </button>
          ) : (
            <button className="btn-primary" onClick={() => void save()}>
              <Save size={15} /> Save Prompt
            </button>
          )}
          <button className="btn-secondary" onClick={() => void addToQueue()}>
            <ListPlus size={15} /> Add to Queue
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setText("");
              setTitle("");
              setCategory("");
              setEditing(null);
            }}
          >
            <Trash2 size={15} /> Clear
          </button>
          <button className="btn-ghost" onClick={() => void copy()}>
            {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Card>

      {/* Bulk import */}
      <Card className="mt-4 flex items-center justify-between p-5">
        <div>
          <h3 className="text-sm font-medium text-ink">Bulk Import</h3>
          <p className="text-xs text-ink-muted">Import prompts from a .txt or .csv file.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="hidden"
            onChange={(e) => void importFile(e)}
          />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Choose File
          </button>
        </div>
      </Card>

      {/* Library */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <FileText size={16} /> Prompt Library
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                className="input !w-56 pl-9"
                placeholder="Search prompts…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  void reload(e.target.value);
                }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-ink-muted">
            <Spinner /> Loading…
          </div>
        ) : library.length ? (
          <div className="grid gap-3">
            {library.map((p) => (
              <Card key={p.id} hover className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{p.title}</span>
                    {p.category && <Badge tone="accent">{p.category}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{preview(p.prompt_text, 160)}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Modified {fmtDateTime(p.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost !p-1.5" title="Add to queue"
                    onClick={async () => {
                      try {
                        await api.jobCreate({ prompt_id: p.id, prompt_text: p.prompt_text });
                        toast("success", "Added to queue.");
                      } catch (e) {
                        toast("error", (e as Error).message);
                      }
                    }}>
                    <ListPlus size={14} />
                  </button>
                  <button className="btn-ghost !p-1.5" title="Edit" onClick={() => void openForEdit(p)}>
                    <PenLine size={14} />
                  </button>
                  <button className="btn-ghost !p-1.5" title="Duplicate" onClick={() => void duplicate(p)}>
                    <Copy size={14} />
                  </button>
                  <button
                    className="btn-ghost !p-1.5 text-error"
                    title="Delete"
                    onClick={() => void remove(p)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Plus size={28} />}
            title={search ? "No matching prompts" : "No prompts yet"}
            hint={search ? "Try a different search." : "Save or import your first prompt."}
          />
        )}
      </div>
    </div>
  );
}
