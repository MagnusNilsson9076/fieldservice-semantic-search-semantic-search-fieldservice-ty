import assert from "node:assert/strict";
import { shouldDispatch, parseSearchBody } from "../src/fieldservice_search.js";

assert.equal(shouldDispatch({ metadata: { status: "awaiting_follow_up" } }), true);
assert.equal(shouldDispatch({ metadata: { status: "closed" } }), false);
assert.deepEqual(parseSearchBody({ query: "frost on compressor", service_area: "north" }), { query: "frost on compressor", service_area: "north", top_k: 5 });
console.log("field-service decision tests passed");
