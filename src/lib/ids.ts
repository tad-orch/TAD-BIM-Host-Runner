import { randomUUID } from "node:crypto";

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function createJobId(): string {
  return `job_${randomUUID()}`;
}
