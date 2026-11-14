import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTOR_CATALOG, CONNECTOR_CATALOG_BY_ID, getConnectorCatalogEntry } from "../src/connector-catalog.js";

test("catalogue contains the complete 120-entry requested inventory", () => {
  assert.equal(CONNECTOR_CATALOG.length, 120);
  assert.equal(CONNECTOR_CATALOG_BY_ID.size, 120);
  assert.equal(new Set(CONNECTOR_CATALOG.map((entry) => entry.id)).size, 120);
});

test("beta providers remain explicitly marked for review", () => {
  for (const id of ["zendesk", "gitlab"]) {
    assert.equal(getConnectorCatalogEntry(id)?.lifecycle, "beta-review");
    assert.equal(getConnectorCatalogEntry(id)?.kind, "beta");
  }
});

test("capabilities and skill packs are not misrepresented as SaaS providers", () => {
  assert.equal(getConnectorCatalogEntry("product-design")?.kind, "capability");
  assert.equal(getConnectorCatalogEntry("company-knowledge")?.kind, "capability");
  assert.equal(getConnectorCatalogEntry("quickstart")?.kind, "skill-pack");
});
