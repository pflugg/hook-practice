import type { IncomingMessage, ServerResponse } from "node:http";
export const TUTOR_MODEL: string;
export interface TutorServiceOptions {
  apiKey?: string;
  budgetPath?: string;
  maxRequests?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  reserveRequest?: (limit: number, client: string) => Promise<boolean>;
}
export function createTutorService(options?: TutorServiceOptions): {
  select(value: unknown, client?: string): Promise<{ status: number; body: Record<string, unknown> }>;
};
export function createTutorHandler(options?: TutorServiceOptions): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
