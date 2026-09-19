import type { z } from "zod";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** The only thing the pipeline needs from a model; swapped for a fake in tests. */
export interface LlmClient {
  model: string;
  /** Provider + model chain; part of every AI cache key, so switching models never serves stale output. */
  config?: string;
  complete(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<string>;
}

const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

/**
 * Hugging Face Inference Providers (OpenAI-compatible chat endpoint) via fetch.
 * Tries each model in order: a model that's unavailable or rate-limited on the
 * free tier falls through to the next.
 */
export function hfClient({
  token = process.env.HF_TOKEN,
  models = (process.env.HF_MODELS ?? "Qwen/Qwen2.5-72B-Instruct,Qwen/Qwen2.5-7B-Instruct,meta-llama/Llama-3.1-8B-Instruct").split(","),
  timeoutMs = 90_000,
} = {}): LlmClient {
  if (!token) throw new Error("HF_TOKEN is not set (see .env.example)");
  const client: LlmClient = {
    model: models[0]!,
    config: `hf|${models.map((m) => m.trim()).join(",")}`,
    async complete(messages, { maxTokens = 2048 } = {}) {
      let last = "";
      for (const model of models) {
        const res = await fetch(HF_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.ok) {
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          client.model = model;
          return body.choices?.[0]?.message?.content ?? "";
        }
        const text = await res.text();
        last = `${model}: HTTP ${res.status} ${text.slice(0, 200)}`;
        // A model none of the account's providers serve is a config gap, not a bad request: try the next one.
        if (!RETRYABLE.has(res.status) && !text.includes("model_not_supported")) break;
      }
      throw new Error(`Hugging Face request failed: ${last}`);
    },
  };
  return client;
}

/** Pull the first balanced JSON object out of a reply (fences and prose tolerated). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON object in model reply");
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("unterminated JSON object in model reply");
}

/**
 * Ask for JSON, validate with zod, and on failure send the exact error back to
 * the model for one repair attempt. Small open models need this loop.
 */
export async function completeJson<S extends z.ZodType>(
  llm: LlmClient,
  messages: ChatMessage[],
  schema: S,
  { retries = 1, maxTokens = 2048 } = {},
): Promise<z.infer<S>> {
  const convo = [...messages];
  for (let attempt = 0; ; attempt++) {
    const reply = await llm.complete(convo, { maxTokens });
    let problem: string;
    try {
      const parsed = schema.safeParse(extractJson(reply));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    if (attempt >= retries) throw new Error(`model output failed validation: ${problem}`);
    convo.push(
      { role: "assistant", content: reply },
      { role: "user", content: `That was not valid. Problems: ${problem}. Reply again with ONLY the corrected JSON object.` },
    );
  }
}
