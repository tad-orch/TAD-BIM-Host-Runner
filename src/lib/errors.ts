import { ZodError } from "zod";

import type { ErrorSummary } from "../types";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function formatZodIssues(error: ZodError): Array<Record<string, unknown>> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function toErrorSummary(error: unknown): ErrorSummary {
  if (error instanceof ZodError) {
    return {
      code: "invalid_payload",
      message: "Request payload is invalid.",
      details: {
        issues: formatZodIssues(error),
      },
    };
  }

  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
    };
  }

  return {
    code: "internal_error",
    message: "Unexpected internal failure.",
  };
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, "invalid_payload", "Request payload is invalid.", {
      issues: formatZodIssues(error),
    });
  }

  if (error instanceof Error) {
    return new AppError(500, "internal_error", error.message);
  }

  return new AppError(500, "internal_error", "Unexpected internal failure.");
}
