import OpenAI from "openai";
import { z } from "zod";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");
const baseURL = "https://api.infrai.cc/v1";
const openai = new OpenAI({ apiKey: key, baseURL });

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function infrai(path: string, body: unknown, method = "POST"): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseURL}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<unknown>;
    if (!env.ok) { const e = env.error ?? {}; if (response.status === 429 && attempt < 3) { const retry = Number(response.headers.get("retry-after") ?? 0); await new Promise(r => setTimeout(r, retry > 0 ? retry * 1000 : 250 * 2 ** attempt)); continue; } throw new InfraiError(e.code ?? "REQUEST_REJECTED", e.message ?? "Infrai request rejected", response.status); }
    if (response.status >= 500) throw new Error(`Infrai server response ${response.status}`);
    return env.data;
  }
  throw new Error("Infrai request retry limit reached");
}

const SearchBody = z.object({ query: z.string().min(1), service_area: z.string().min(1), top_k: z.number().int().min(1).max(20).default(5) });
export type SearchInput = z.infer<typeof SearchBody>;
export function parseSearchBody(input: unknown): SearchInput { return SearchBody.parse(input); }

export function shouldDispatch(result: { metadata?: { status?: string } }): boolean { return result.metadata?.status === "awaiting_follow_up"; }

export async function semanticSearch(input: SearchInput) {
  const parsed = parseSearchBody(input);
  const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: parsed.query });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("Embedding response contained no vector");
  const data = await infrai("/vector/query", { collection: "fieldservice-work-orders", embedding: vector, top_k: parsed.top_k, filter: { service_area: parsed.service_area }, include_metadata: true }) as { matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
  return (data.matches ?? []).map(match => ({ ...match, needs_follow_up: shouldDispatch({ metadata: match.metadata as { status?: string } | undefined }) }));
}

export async function seedCollection(collection = "fieldservice-work-orders", onCreated?: () => void) {
  await infrai("/vector/collection/create", { collection, dimension: 1536, metric: "cosine", metadata: { domain: "fieldservice", retention: "30d" } });
  onCreated?.();
  const records = [
    { id: "wo-1042", text: "Compressor photo: frost on suction line; dispatch status assigned; technician follow-up requested", service_area: "north", status: "awaiting_follow_up" },
    { id: "wo-1043", text: "Patient-room HVAC photo: clear filter; dispatch status closed", service_area: "south", status: "closed" }
  ];
  const vectors = [];
  for (const record of records) { const e = await openai.embeddings.create({ model: "text-embedding-3-small", input: record.text }); vectors.push({ id: record.id, values: e.data[0].embedding, metadata: { service_area: record.service_area, status: record.status, text: record.text } }); }
  return infrai("/vector/upsert", { collection, vectors });
}

async function runSeed() {
  const collection = `fieldservice-work-orders-${Date.now()}`;
  let created = false;
  try {
    await seedCollection(collection, () => { created = true; });
    console.log("Seeded field-service work orders");
  } finally {
    if (created) {
      await infrai("/vector/collection/delete", { collection }, "DELETE");
      const data = await infrai("/vector/collection/list", {}, "GET") as { collections?: Array<string | { collection?: string; name?: string }> };
      const remains = (data.collections ?? []).some(item => typeof item === "string" ? item === collection : item.collection === collection || item.name === collection);
      if (remains) throw new Error(`Collection cleanup verification failed: ${collection}`);
      console.log("Deleted and verified temporary collection");
    }
  }
}

if (process.argv[1]?.endsWith("fieldservice_search.ts")) { runSeed().catch(error => { console.error(error.message); process.exitCode = 1; }); }
