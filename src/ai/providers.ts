import Anthropic from "@anthropic-ai/sdk";
import type { Database } from "../db";
import { resolveKey, type SecretKind } from "../keys";
import { type ChatMessage, hfClient, type LlmClient } from "./llm";

/**
 * Model pool: every provider speaks the same LlmClient interface, so the
 * pipeline, grounding and caching stay provider-agnostic. Which providers a
 * user gets depends on the keys in their encrypted vault (then the server's
 * env keys); requests fall through the pool in order when one fails.
 */
export type Provider = "anthropic" | "openai" | "huggingface";
export const PROVIDER_ORDER: Provider[] = ["anthropic", "openai", "huggingface"];
export const PROVIDER_NAME: Record<Provider, string> = { anthropic: "Claude", openai: "ChatGPT", huggingface: "Hugging Face" };

const ANTHROPIC_MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
const OPENAI_MODEL = () => process.env.OPENAI_MODEL ?? "gpt-5-mini";

/** Anthropic takes the system prompt as a separate field, not a message. */
export function toAnthropic(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system: system || undefined, messages: rest };
}

export function anthropicClient(apiKey: string, model = ANTHROPIC_MODEL()): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  return {
    model,
    config: `anthropic|${model}`,
    async complete(messages, { maxTokens = 2048 } = {}) {
      // Streamed + finalMessage(): no request timeouts on long outputs. Claude Opus 5 thinks adaptively by
      // default, so leave headroom above the answer budget for its reasoning.
      const msg = await client.messages.stream({ model, max_tokens: Math.max(16_000, maxTokens * 4), ...toAnthropic(messages) }).finalMessage();
      return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    },
  };
}

export function openaiClient(apiKey: string, model = OPENAI_MODEL()): LlmClient {
  return {
    model,
    config: `openai|${model}`,
    async complete(messages, { maxTokens = 2048 } = {}) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        // Current OpenAI reasoning models take max_completion_tokens and only the default temperature.
        body: JSON.stringify({ model, messages, max_completion_tokens: Math.max(4_000, maxTokens * 4) }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content ?? "";
    },
  };
}

/** Try each client in order; the first answer wins. `model` reports who actually answered. */
export function poolClient(clients: LlmClient[]): LlmClient {
  const pool: LlmClient = {
    model: clients[0]!.model,
    config: clients.map((c) => c.config ?? c.model).join(" > "),
    async complete(messages, opts) {
      const errors: string[] = [];
      for (const c of clients) {
        try {
          const out = await c.complete(messages, opts);
          pool.model = c.model;
          return out;
        } catch (e) {
          errors.push(`${c.model}: ${e instanceof Error ? e.message : e}`);
        }
      }
      throw new Error(`every model in the pool failed: ${errors.join(" | ")}`);
    },
  };
  return pool;
}

const make = (p: Provider, key: string) => (p === "anthropic" ? anthropicClient(key) : p === "openai" ? openaiClient(key) : hfClient({ token: key }));

/** Which providers a user's requests go to, and whose key each uses. */
export async function providersFor(db: Database, userId: string | null | undefined) {
  const found = await Promise.all(PROVIDER_ORDER.map(async (p) => ({ provider: p, key: await resolveKey(db, userId, p as SecretKind) })));
  // The user's own keys first (their bill, their choice), then the server's.
  return [...found.filter((f) => f.key?.source === "tenant"), ...found.filter((f) => f.key?.source === "env")]
    .map((f) => ({ provider: f.provider, source: f.key!.source, key: f.key!.key }));
}

export async function llmForUser(db: Database, userId: string | null | undefined): Promise<LlmClient | null> {
  const list = await providersFor(db, userId);
  return list.length ? poolClient(list.map((p) => make(p.provider, p.key))) : null;
}
