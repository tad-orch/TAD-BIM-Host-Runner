import type { AuditEntry } from "../types";
import { AuditRepository } from "../db/repositories/audit-repo";

export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async record(entry: AuditEntry): Promise<void> {
    this.auditRepository.record(entry);
  }
}
