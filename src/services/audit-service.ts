import fs from "node:fs/promises";
import path from "node:path";

import type { AuditEntry } from "../types";

export class AuditService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "", "utf8");
    }
  }

  async record(entry: AuditEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(() =>
      fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, "utf8"),
    );

    return this.writeQueue;
  }
}
