import { z } from "zod";
import { apiUser } from "@/api-guard";
import { apiActionItems, apiAsk, apiMeeting, apiMeetings, apiSearch } from "@/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * MCP server (Streamable HTTP, stateless): JSON-RPC over POST, one JSON
 * response per request, no sessions, so every Vercel instance can serve any
 * call. Connect Claude, ChatGPT or Cursor with a Parley token that has the
 * `read` scope, e.g.
 *   claude mcp add --transport http parley https://<app>/api/mcp --header "Authorization: Bearer parley_pat_…"
 */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const TOOLS = [
  {
    name: "search_meetings", title: "Search meetings",
    description: "Find every moment a topic came up across the user's recorded meetings (synonym-aware: 'SSO' also matches 'single sign-on'). Returns quotes with speaker, meeting and a link to the exact time.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words or phrase to find" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query"] },
    args: z.object({ query: z.string().min(2).max(200), limit: z.int().min(1).max(50).optional() }),
    run: (uid: string, a: { query: string; limit?: number }) => apiSearch(uid, a.query, a.limit ?? 20),
  },
  {
    name: "ask_parley", title: "Ask Parley",
    description: "Answer a question using only the user's meeting transcripts. The answer cites numbered sources with links; uncited claims are removed.",
    inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
    args: z.object({ question: z.string().min(3).max(500) }),
    run: (uid: string, a: { question: string }) => apiAsk(uid, a.question),
  },
  {
    name: "list_meetings", title: "List meetings",
    description: "The user's most recent meetings with overview, participants and action-item counts.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
    args: z.object({ limit: z.int().min(1).max(100).optional() }),
    run: (uid: string, a: { limit?: number }) => apiMeetings(uid, a.limit ?? 20),
  },
  {
    name: "get_meeting", title: "Get meeting",
    description: "One meeting's summary sections, action items, highlights and clips; optionally the full timestamped transcript.",
    inputSchema: { type: "object", properties: { meeting_id: { type: "string", format: "uuid" }, include_transcript: { type: "boolean" } }, required: ["meeting_id"] },
    args: z.object({ meeting_id: z.uuid(), include_transcript: z.boolean().optional() }),
    run: async (uid: string, a: { meeting_id: string; include_transcript?: boolean }) => (await apiMeeting(uid, a.meeting_id, { transcript: !!a.include_transcript })) ?? { error: "meeting not found" },
  },
  {
    name: "list_action_items", title: "List action items",
    description: "Action items from the user's meetings, with owner, due date and a link to where it was agreed.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "done"] } } },
    args: z.object({ status: z.enum(["open", "done"]).optional() }),
    run: (uid: string, a: { status?: "open" | "done" }) => apiActionItems(uid, a.status),
  },
] as const;

const rpc = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });
const reply = (id: unknown, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string, status = 200) => Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function POST(req: Request) {
  const auth = await apiUser(req);
  if ("error" in auth) return auth.error;
  const parsed = rpc.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(null, -32700, "expected a single JSON-RPC 2.0 message", 400);
  const { id, method, params } = parsed.data;
  if (id === undefined) return new Response(null, { status: 202 }); // notifications (e.g. notifications/initialized)

  switch (method) {
    case "initialize": {
      const asked = String(params?.protocolVersion ?? "");
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "parley", title: "Parley meeting notes", version: "1.0.0" },
        instructions: "Tools over the user's own recorded meetings. Prefer ask_parley for questions, search_meetings for 'where did we talk about…', and cite the returned links.",
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: { readOnlyHint: true } })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return fail(id, -32602, `unknown tool: ${String(params?.name)}`);
      const args = tool.args.safeParse(params?.arguments ?? {});
      if (!args.success) return reply(id, { isError: true, content: [{ type: "text", text: `Invalid arguments: ${args.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` }] });
      try {
        const out = await (tool.run as (uid: string, a: unknown) => Promise<unknown>)(auth.me.id, args.data);
        return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: Array.isArray(out) ? { items: out } : out });
      } catch (e) {
        return reply(id, { isError: true, content: [{ type: "text", text: `Parley couldn't run ${tool.name}: ${e instanceof Error ? e.message : e}` }] });
      }
    }
    default:
      return fail(id, -32601, `method not found: ${method}`);
  }
}

/** No server-initiated stream: this server only answers requests. */
export const GET = () => new Response(null, { status: 405, headers: { allow: "POST" } });
export const DELETE = GET;
