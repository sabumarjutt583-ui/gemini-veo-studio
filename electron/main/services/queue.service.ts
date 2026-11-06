import type { Repositories } from "../database/repositories";
import type { GenerationJob, JobStatus, NewJob } from "@shared/types";
import { JOB_STATUS_TRANSITIONS } from "@shared/types";
import type { JobFilter } from "@shared/ipc";

/**
 * Generation queue. The queue is deliberately a user-driven workflow:
 * the app stages a task, opens Gemini, copies the prompt, and records the
 * user's confirmation as the task advances through its statuses. No
 * automated account switching ever happens here — a paused/cooldown task
 * stays paused until the user explicitly resumes it.
 */
export class QueueService {
  constructor(private readonly repos: Repositories) {}

  list(filter: JobFilter = {}): GenerationJob[] {
    return this.repos.jobs.list(filter);
  }

  get(id: number): GenerationJob | null {
    return this.repos.jobs.get(id);
  }

  create(input: NewJob): GenerationJob {
    const job = this.repos.jobs.create(input);
    this.repos.activity.log({
      action: "job.created",
      entity_type: "job",
      entity_id: String(job.id),
      description: `Queued task (#${job.id}) with prompt "${truncate(job.prompt_text, 40)}"`,
    });
    return job;
  }

  update(id: number, input: Partial<NewJob>): GenerationJob | null {
    const job = this.repos.jobs.update(id, input);
    if (job) {
      this.repos.activity.log({
        action: "job.updated",
        entity_type: "job",
        entity_id: String(id),
        description: `Updated task #${id}`,
      });
    }
    return job;
  }

  /**
   * Move a task to a new status, enforcing the transition matrix. Illegal
   * transitions throw (caught and surfaced by the IPC handler), which keeps
   * the state machine predictable.
   */
  setStatus(id: number, status: JobStatus): GenerationJob {
    const job = this.repos.jobs.get(id);
    if (!job) throw new Error(`Task ${id} not found`);
    const allowed = JOB_STATUS_TRANSITIONS[job.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(
        `Illegal transition: ${job.status} -> ${status}. Allowed: ${allowed.join(", ")}`
      );
    }
    const updated = this.repos.jobs.setStatus(id, status);
    this.repos.activity.log({
      action: "job.status",
      entity_type: "job",
      entity_id: String(id),
      description: `Task #${id}: ${job.status} -> ${status}`,
    });
    return updated as GenerationJob;
  }

  /** Cancel a task: allowed from any non-terminal status. */
  cancel(id: number): GenerationJob {
    const job = this.repos.jobs.get(id);
    if (!job) throw new Error(`Task ${id} not found`);
    const target: JobStatus = job.status === "completed" ? "completed" : "failed";
    if (job.status === "completed" || job.status === "failed") {
      throw new Error(`Task #${id} is already terminal (${job.status})`);
    }
    return this.setStatus(id, target);
  }

  /**
   * Retry a failed task: reset it to "pending" so the user can re-open it in
   * Gemini. Only from the failed state.
   */
  retry(id: number): GenerationJob {
    const job = this.repos.jobs.get(id);
    if (!job) throw new Error(`Task ${id} not found`);
    if (job.status !== "failed") {
      throw new Error(`Retry only applies to failed tasks, not ${job.status}`);
    }
    // Move back to pending so the user can re-open it in Gemini.
    const updated = this.repos.jobs.setStatus(id, "pending");
    this.repos.activity.log({
      action: "job.retry",
      entity_type: "job",
      entity_id: String(id),
      description: `Retried task #${id}`,
    });
    return updated as GenerationJob;
  }

  /** Reorder tasks by the given id order. */
  reorder(ids: number[]): void {
    this.repos.jobs.reorder(ids);
    this.repos.activity.log({
      action: "job.reorder",
      entity_type: "job",
      entity_id: ids.join(","),
      description: `Reordered ${ids.length} tasks`,
    });
  }

  /** Delete a task (and unlink its videos — videos keep their own rows). */
  delete(id: number): boolean {
    const existed = this.repos.jobs.get(id);
    const deleted = this.repos.jobs.delete(id);
    if (deleted) {
      this.repos.activity.log({
        action: "job.deleted",
        entity_type: "job",
        entity_id: String(id),
        description: existed ? `Deleted task #${id}` : "Deleted task",
      });
    }
    return deleted;
  }

  /**
   * Queue-level pause: flip every active, non-terminal task to "paused"
   * WITHOUT touching completed/failed tasks. This is the "pause queue"
   * action — it never auto-rotates accounts (spec rule).
   */
  pauseQueue(): number {
    const active = this.repos.jobs.list();
    let count = 0;
    for (const job of active) {
      const resumable: JobStatus[] = ["pending", "ready", "opened_in_gemini", "awaiting_user_submission"];
      if (resumable.includes(job.status)) {
        this.repos.jobs.setStatus(job.id, "paused");
        count += 1;
      }
    }
    if (count) {
      this.repos.activity.log({
        action: "job.queue-paused",
        entity_type: "job",
        entity_id: String(count),
        description: `Paused ${count} active task(s)`,
      });
    }
    return count;
  }

  /** Resume a previously-paused task back to where it was before pause. */
  resumeTask(id: number): GenerationJob {
    const job = this.repos.jobs.get(id);
    if (!job) throw new Error(`Task ${id} not found`);
    if (job.status !== "paused") {
      throw new Error(`Task #${id} is not paused (it is ${job.status})`);
    }
    const restored: JobStatus = "pending";
    const updated = this.repos.jobs.setStatus(id, restored);
    this.repos.activity.log({
      action: "job.resumed",
      entity_type: "job",
      entity_id: String(id),
      description: `Resumed task #${id}`,
    });
    return updated as GenerationJob;
  }

  /** Resume every paused task back to pending. */
  resumeQueue(): number {
    const active = this.repos.jobs.list({ status: "paused" });
    let count = 0;
    for (const job of active) {
      this.repos.jobs.setStatus(job.id, "pending");
      count += 1;
    }
    if (count) {
      this.repos.activity.log({
        action: "job.queue-resumed",
        entity_type: "job",
        entity_id: String(count),
        description: `Resumed ${count} paused task(s)`,
      });
    }
    return count;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
