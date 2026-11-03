const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("manifest keeps broad website access optional", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
});

test("API key is stored locally and removed from sync", () => {
  const options = fs.readFileSync(path.join(root, "options.js"), "utf8");
  assert.match(options, /chrome\.storage\.local\.set\(\{ \[API_KEY_FIELD\]/);
  assert.match(options, /chrome\.storage\.sync\.remove\(API_KEY_FIELD\)/);
  assert.doesNotMatch(options, /chrome\.storage\.sync\.set\(\{[^}]*apiKey/s);
});

test("model use requires an explicit data-flow acknowledgement", () => {
  const options = fs.readFileSync(path.join(root, "options.js"), "utf8");
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(options, /dataConsentAccepted/);
  assert.match(content, /local\[DATA_CONSENT_FIELD\] \? storedApiKey : ""/);
  assert.match(content, /if \(state\.settings\[DATA_CONSENT_FIELD\]\) \{\s*startDataFeatures\(\)/);
  assert.match(content, /function stopDataFeatures\(\)/);
});
