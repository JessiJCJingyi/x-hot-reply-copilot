const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadContentForEditorTest() {
  const calls = [];
  class FakeDataTransfer {
    constructor() {
      this.data = {};
    }
    getData(type) {
      return this.data[type] || "";
    }
    setData(type, value) {
      this.data[type] = value;
    }
  }
  class FakeClipboardEvent {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  const context = {
    ClipboardEvent: FakeClipboardEvent,
    console,
    DataTransfer: FakeDataTransfer,
    document: {},
    location: { pathname: "/home" },
    Promise,
    window: {
      setTimeout
    }
  };
  vm.createContext(context);
  const source = fs
    .readFileSync(path.join(root, "content.js"), "utf8")
    .replace(/^init\(\);$/m, "// init disabled in editor unit test");
  vm.runInContext(source, context);
  return { calls, context };
}

test("insertion asks the X editor to handle a paste event", () => {
  const { calls, context } = loadContentForEditorTest();
  const editor = {
    dispatchEvent(event) {
      calls.push(["dispatchEvent", event.type, event.clipboardData.getData("text/plain")]);
      return true;
    },
    focus() {
      calls.push(["focus"]);
    }
  };
  Object.defineProperty(editor, "textContent", {
    set() {
      throw new Error("Direct DOM text assignment breaks X editor state");
    }
  });

  const result = context.dispatchPasteToEditor(editor, "Editable reply");

  assert.equal(result, true);
  assert.deepEqual(calls, [
    ["focus"],
    ["dispatchEvent", "paste", "Editable reply"]
  ]);
});

test("content script never writes directly into the X editor DOM", () => {
  const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.doesNotMatch(source, /execCommand\s*\(/);
  assert.doesNotMatch(source, /editor\.textContent\s*=/);
});
