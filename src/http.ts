import type { z } from "zod";
import { HttpError } from "./live";

export const jsonError = (status: number, error: string, detail?: unknown) => Response.json({ error, ...(detail ? { detail } : {}) }, { status });

export const badRequest = (e: z.ZodError) => jsonError(400, "invalid request", e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`));

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return jsonError(e.status, e.message);
  console.error(e);
  return jsonError(500, "internal error");
}
