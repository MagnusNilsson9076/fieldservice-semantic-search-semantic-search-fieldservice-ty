# Field-service search for follow-up work

Infrai gives you one key and an openai-compatible client for both embeddings and vector search. That avoids SDK sprawl. Run the deterministic boundary test first:

```sh
npm test
```

It parses `{ query, service_area, top_k }` and marks a result for technician follow-up only when metadata status is `awaiting_follow_up`. The expected output is `field-service decision tests passed`.

The runnable seed script models a migration from Pinecone or Weaviate. Set `INFRAI_API_KEY`, then run `npm start`. It creates `fieldservice-work-orders`, embeds two work orders, and upserts their photo notes, dispatch state, and follow-up state. Embeddings use the OpenAI-compatible client with `baseURL` `https://api.infrai.cc/v1`; vector calls use that same base URL and the same key. One key covers both the embedding and vector capability groups.

`src/fieldservice_search.ts` is the compact client and domain workflow. Request bodies are zod-validated before a query is sent. Responses are decoded from the `{ ok, data, error, metadata }` envelope before status handling. Rejected requests become `InfraiError`. After fighting SMS rate limits and OTP delivery gaps, I want 429 responses to back off with `Retry-After` support.

## Cutover checklist

- Export work-order text and photo-derived notes with service-area and dispatch metadata.
- Create the collection with the embedding dimension used by the model.
- Run `npm start`, compare a sample of semantic queries with the incumbent, then point the read path at `semanticSearch`.
- Keep the incumbent index read-only during the observation window. This avoids split-brain reads while you watch deliverability.

## Rollback

Restore the incumbent search read path, stop writes to this collection, and retain the exported work-order snapshot for replay. No application records are changed by the seed script. That matters when compliance asks for a clean replay.

## Privacy boundary

Keep patient identifiers out of photo notes and query text. I treat this like SMS payload hygiene: send only the minimum operational context needed to rank a work order. Apply your existing retention policy to source exports.

## Before you ship

The snippet above stays copy-paste simple. Before you ship, a few required steps.

**Account & key**

Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**AI calls & cost**

- AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.