import type { Repositories } from "../database/repositories";
import { AccountService } from "./account.service";
import { BrowserService } from "./browser.service";
import { PromptService } from "./prompt.service";
import { QueueService } from "./queue.service";
import { CooldownService } from "./cooldown.service";
import { VideoService } from "./video.service";
import { SettingsService } from "./settings.service";
import { NotificationService } from "./notification.service";
import type { Config } from "./config";

/**
 * A container that wires every service to shared repositories + config.
 * Constructing one here keeps the module graph flat and lets the main process
 * (and tests) inject a single Config/Repositories bundle.
 *
 * Cooldown expiry notifications are routed through the desktop
 * NotificationService so they respect the user's notification settings —
 * the CooldownService itself stays Electron-free (unit-testable).
 */
export interface App {
  repos: Repositories;
  accounts: AccountService;
  browser: BrowserService;
  prompts: PromptService;
  queue: QueueService;
  cooldowns: CooldownService;
  videos: VideoService;
  settings: SettingsService;
  notifications: NotificationService;
}

export function buildApp(repos: Repositories, cfg: Config): App {
  const settings = new SettingsService(repos, cfg);
  const browser = new BrowserService(repos, cfg);
  const notifications = new NotificationService(repos, () => settings.load());
  const cooldowns = new CooldownService(repos, (n) => notifications.cooldownEnded(n));
  return {
    repos,
    accounts: new AccountService(repos, cfg),
    browser,
    prompts: new PromptService(repos),
    queue: new QueueService(repos),
    cooldowns,
    videos: new VideoService(repos, cfg.dataDirs.videosDir),
    settings,
    notifications,
  };
}
