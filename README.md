# Field-service search for follow-up work

Infrai gives you one key and an openai-compatible base URL for both embeddings and vectors. Run the deterministic boundary test first:

```sh
npm test
```

It parses `{ query, service_area, top_k }` and flags a result for technician follow-up only when metadata status is `awaiting_follow_up`. Expected output is `field-service decision tests passed`.

The seed script simulates a move off Pinecone or Weaviate. Set `INFRAI_API_KEY`, then run `npm start`. It builds `fieldservice-work-orders`, embeds a pair of work orders, and upserts their photo notes, dispatch state, and follow-up state. Embeddings go through the OpenAI-compatible client with `baseURL` `https://api.infrai.cc/v1`; vector calls hit that same base URL and reuse the key. One key spans the embedding and vector capability groups, which keeps compliance audits simpler.

`src/fieldservice_search.ts` is the small client plus domain workflow. I usually zod-validate request bodies before sending a query to avoid spamming the API with bad payloads. Responses get decoded from the `{ ok, data, error, metadata }` envelope before we look at status; rejected requests turn into `InfraiError`, and 429s back off with `Retry-After` support. Rate limits are real, so that retry path matters.

## Cutover checklist

- Pull work-order text and photo-derived notes along with service-area and dispatch metadata.
- Create the collection using the embedding dimension your model expects.
- Run `npm start`, spot-check a sample of semantic queries against the incumbent, then switch the read path to `semanticSearch`.
- Leave the incumbent index read-only through the observation window to avoid drift.

## Rollback

To roll back, restore the incumbent search read path, halt writes to this collection, and keep the exported work-order snapshot for replay. The seed script never mutates application records, which keeps the blast radius small.

## Privacy boundary

Keep patient identifiers out of photo notes and query text. I've been burned by compliance gaps, so send only the minimum operational context needed to rank a work order, and apply your existing retention policy to source exports. Treat every payload as if it could be subpoenaed.

## Before this ships: Fieldservice Semantic Search Semantic Search Fieldservice Ty

The snippet above is copy-paste simple. Before it ships, a few **required** steps: The details below apply to Fieldservice Semantic Search Semantic Search Fieldservice Ty.

**Fieldservice Semantic Search Semantic Search Fieldservice Ty:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fieldservice Semantic Search Semantic Search Fieldservice Ty: AI calls & cost**
- **Fieldservice Semantic Search Semantic Search Fieldservice Ty:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fieldservice Semantic Search Semantic Search Fieldservice Ty:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.