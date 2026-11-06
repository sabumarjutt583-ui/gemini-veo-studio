import type { Db } from "../database";
import { AccountRepository } from "./account.repo";
import { PromptRepository } from "./prompt.repo";
import { JobRepository } from "./job.repo";
import { CooldownRepository } from "./cooldown.repo";
import { VideoRepository } from "./video.repo";
import { ActivityRepository } from "./activity.repo";
import { SettingsRepository } from "./settings.repo";

/**
 * A bundle of all repositories wired to a single connection. Building them
 * together keeps the services and the app from constructing repos ad-hoc, and
 * makes it easy to swap in an in-memory db for tests.
 */
export interface Repositories {
  db: Db;
  accounts: AccountRepository;
  prompts: PromptRepository;
  jobs: JobRepository;
  cooldowns: CooldownRepository;
  videos: VideoRepository;
  activity: ActivityRepository;
  settings: SettingsRepository;
}

export function createRepositories(db: Db): Repositories {
  return {
    db,
    accounts: new AccountRepository(db),
    prompts: new PromptRepository(db),
    jobs: new JobRepository(db),
    cooldowns: new CooldownRepository(db),
    videos: new VideoRepository(db),
    activity: new ActivityRepository(db),
    settings: new SettingsRepository(db),
  };
}

export * from "./account.repo";
export * from "./prompt.repo";
export * from "./job.repo";
export * from "./cooldown.repo";
export * from "./video.repo";
export * from "./activity.repo";
export * from "./settings.repo";
