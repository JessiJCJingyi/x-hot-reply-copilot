const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadBackground(fetchImpl = fetch) {
  const context = {
    AbortController,
    chrome: { runtime: { onMessage: { addListener() {} } } },
    clearTimeout,
    console,
    fetch: fetchImpl,
    setTimeout,
    URL
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
  vm.runInContext(source, context);
  return context;
}

function loadOptions() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        addEventListener() {},
        disabled: false,
        placeholder: "",
        textContent: "",
        title: "",
        value: ""
      });
    }
    return elements.get(id);
  };
  const context = {
    chrome: { storage: { sync: { async get() { return {}; }, async set() {} } } },
    console,
    document: {
      addEventListener() {},
      getElementById: element
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, "options.js"), "utf8");
  vm.runInContext(source, context);
  return { context, element };
}

test("detects common providers from API Base URL", () => {
  const { context } = loadOptions();
  assert.equal(context.detectProviderFromUrl("https://api.ikuncode.cc/v1"), "ikuncode");
  assert.equal(context.detectProviderFromUrl("https://openrouter.ai/api/v1"), "openrouter");
  assert.equal(context.detectProviderFromUrl("https://api.deepseek.com"), "deepseek");
  assert.equal(context.detectProviderFromUrl("https://api.openai.com/v1"), "openai");
  assert.equal(context.detectProviderFromUrl("https://api.siliconflow.cn/v1"), "siliconflow");
  assert.equal(context.detectProviderFromUrl("https://gateway.example.com/v1"), "");
});

test("switching to IKunCode selects its documented chat preset", () => {
  const { context, element } = loadOptions();
  element("provider").value = "openrouter";
  element("model").value = "anthropic/claude-opus-4.8";
  element("apiBaseUrl").value = "https://api.ikuncode.cc/v1";
  context.syncProviderFromBaseUrl();
  assert.equal(element("provider").value, "ikuncode");
  assert.equal(element("apiMode").value, "chat");
  assert.equal(element("model").value, "claude-opus-4-6");
  assert.match(element("providerHint").textContent, /IKunCode/);
});

test("switching Base URL updates provider, API mode, and default model", () => {
  const { context, element } = loadOptions();
  element("provider").value = "openrouter";
  element("model").value = "anthropic/claude-opus-4.8";
  element("apiBaseUrl").value = "https://api.deepseek.com";
  context.syncProviderFromBaseUrl();
  assert.equal(element("provider").value, "deepseek");
  assert.equal(element("apiMode").value, "chat");
  assert.equal(element("model").value, "deepseek-chat");
  assert.match(element("providerHint").textContent, /DeepSeek/);
});

test("normalizes stale provider settings from the saved Base URL", () => {
  const { context } = loadOptions();
  const settings = {
    provider: "openrouter",
    apiBaseUrl: "https://api.deepseek.com",
    apiMode: "chat",
    model: "anthropic/claude-opus-4.8"
  };
  context.normalizeProviderSettings(settings);
  assert.equal(settings.provider, "deepseek");
  assert.equal(settings.model, "deepseek-chat");
});

test("disables unsupported saved provider settings without redirecting credentials", () => {
  const { context } = loadOptions();
  const settings = {
    provider: "removed-provider",
    apiBaseUrl: "https://removed-provider.invalid/v1",
    apiMode: "chat",
    model: "removed-model",
    apiKey: "existing-secret"
  };
  context.normalizeProviderSettings(settings);
  assert.equal(settings.provider, "custom");
  assert.equal(settings.apiBaseUrl, "");
  assert.equal(settings.model, "");
  assert.equal(settings.apiKey, "existing-secret");
});

test("keeps a user-selected OpenRouter model", () => {
  const context = loadBackground();
  assert.equal(context.resolveModel({
    provider: "openrouter",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiMode: "chat",
    model: "deepseek/deepseek-chat"
  }), "deepseek/deepseek-chat");
});

test("resolves IKunCode's documented default model", () => {
  const context = loadBackground();
  assert.equal(context.resolveModel({
    provider: "custom",
    apiBaseUrl: "https://api.ikuncode.cc/v1",
    apiMode: "chat",
    model: ""
  }), "claude-opus-4-6");
});

test("allows IKunCode more time for Opus responses", () => {
  const context = loadBackground();
  assert.equal(context.getModelRequestTimeout({
    provider: "deepseek",
    apiBaseUrl: "https://api.deepseek.com"
  }), 45000);
  assert.equal(context.getModelRequestTimeout({
    provider: "ikuncode",
    apiBaseUrl: "https://api.ikuncode.cc/v1"
  }), 90000);
});

test("IKunCode generation uses the documented chat endpoint and Opus model", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: '["IKunCode reply"]' } }] };
      }
    };
  };
  const context = loadBackground(fakeFetch);
  const result = await context.generateReplies({
    apiKey: "ikun-test-key",
    provider: "ikuncode",
    apiBaseUrl: "https://api.ikuncode.cc/v1",
    apiMode: "chat",
    model: "",
    tweetText: "A test post",
    replyType: "pure_value",
    count: 1,
    accountProfile: {}
  });
  assert.equal(request.url, "https://api.ikuncode.cc/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer ikun-test-key");
  assert.equal(request.body.model, "claude-opus-4-6");
  assert.equal(result.model, "claude-opus-4-6");
});

test("relay generation unwraps Claude-style content blocks", async () => {
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [{
          message: {
            content: [{
              type: "text",
              text: '["第一条自然回复", "第二条自然回复"]'
            }]
          }
        }]
      };
    }
  });
  const context = loadBackground(fakeFetch);
  const result = await context.generateReplies({
    apiKey: "relay-test-key",
    provider: "ikuncode",
    apiBaseUrl: "https://api.ikuncode.cc/v1",
    apiMode: "chat",
    model: "claude-opus-4-6",
    tweetText: "A test post",
    replyType: "pure_value",
    count: 2,
    accountProfile: {}
  });
  assert.deepEqual(Array.from(result.replies), ["第一条自然回复", "第二条自然回复"]);
  assert.doesNotMatch(result.replies.join(" "), /\[object Object\]/);
});

test("relay generation rejoins JSON split across multiple content blocks", async () => {
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [{
          message: {
            content: [
              { type: "text", text: '["第一条被拆开的' },
              { type: "text", text: '回复","第二条回复"]' }
            ]
          }
        }]
      };
    }
  });
  const context = loadBackground(fakeFetch);
  const result = await context.generateReplies({
    apiKey: "relay-test-key",
    provider: "ikuncode",
    apiBaseUrl: "https://api.ikuncode.cc/v1",
    apiMode: "chat",
    model: "claude-opus-4-6",
    tweetText: "A test post",
    replyType: "pure_value",
    count: 2,
    accountProfile: {}
  });
  assert.deepEqual(Array.from(result.replies), ["第一条被拆开的回复", "第二条回复"]);
});

test("reply parser accepts object-wrapped reply items", () => {
  const context = loadBackground();
  const replies = context.parseReplies('[{"text":"第一条"},{"reply":"第二条"}]');
  assert.deepEqual(Array.from(replies), ["第一条", "第二条"]);
});

test("different user profiles produce different personalized prompts", () => {
  const context = loadBackground();
  const shared = { tweetText: "AI agent adoption is moving from demos into daily workflows.", replyType: "product_insight", count: 5 };
  const financeProfile = {
    profileMode: "product",
    productName: "AlphaLens",
    productSummary: "AI research for public-market investors",
    audience: "independent investors",
    positioning: "evidence-first investment research",
    coreValue: "reduce research blind spots",
    useCases: "earnings research",
    differentiator: "source-linked claims",
    tone: "skeptical and concise",
    bannedWords: "guaranteed returns"
  };
  const designProfile = {
    profileMode: "product",
    productName: "PixelFlow",
    productSummary: "A collaboration workspace for product designers",
    audience: "design teams",
    positioning: "faster design review",
    coreValue: "reduce feedback loops",
    useCases: "prototype review",
    differentiator: "feedback attached to UI states",
    tone: "practical and friendly",
    bannedWords: "revolutionary"
  };
  const financePrompt = context.buildPrompt({ ...shared, accountProfile: financeProfile });
  const designPrompt = context.buildPrompt({ ...shared, accountProfile: designProfile });
  assert.match(financePrompt, /AlphaLens/);
  assert.match(financePrompt, /independent investors/);
  assert.doesNotMatch(financePrompt, /PixelFlow/);
  assert.match(designPrompt, /PixelFlow/);
  assert.match(designPrompt, /design teams/);
  assert.doesNotMatch(designPrompt, /AlphaLens/);
  assert.match(financePrompt, /去 AI 味自检/);
});

test("persona bio and strict Chinese language are included in the model prompt", () => {
  const context = loadBackground();
  const prompt = context.buildPrompt({
    tweetText: "AI agents are changing how teams work.",
    replyType: "pure_value",
    count: 5,
    accountProfile: {
      profileMode: "persona",
      personaIdentity: "Jessi Cao",
      personaBio: "连续创业者，长期关注 AI 产品增长与投资",
      personaVoice: "直接、克制、偏实战",
      replyLanguage: "zh",
      mentionPolicy: "never"
    }
  });
  assert.match(prompt, /连续创业者，长期关注 AI 产品增长与投资/);
  assert.match(prompt, /所有回复都必须使用简体中文/);
  assert.match(prompt, /不输出完整英文句子/);
  assert.match(prompt, /最新公开语料提炼出的表达画像/);
  assert.match(prompt, /产品先看是否进入真实工作流/);
});

test("reply angle plans rotate by post while staying diverse", () => {
  const context = loadBackground();
  const first = context.buildReplyAnglePlan(5, "AI 产品应该怎样验证用户留存");
  const second = context.buildReplyAnglePlan(5, "长期投资如何控制回撤");
  assert.notEqual(first, second);
  assert.equal(first.split("\n").length, 5);
  assert.equal(new Set(first.split("\n")).size, 5);
});

test("private corpus text is not required to activate Jessi's public style profile", () => {
  const context = loadBackground();
  const evidence = context.getProfileEvidence({
    profileMode: "persona",
    personaIdentity: "Jessi Cao",
    personaBio: "AI product growth and investment"
  });
  assert.equal(evidence.stylePack, "Jessi 最新公开语料画像");
  assert.equal(evidence.personalized, true);
});

test("reports whether enough profile fields were used", () => {
  const context = loadBackground();
  const evidence = context.getProfileEvidence({
    profileMode: "product",
    productName: "AlphaLens",
    audience: "investors",
    coreValue: "reduce research blind spots"
  });
  assert.equal(evidence.name, "AlphaLens");
  assert.equal(evidence.anchorCount, 2);
  assert.equal(evidence.personalized, true);
});

test("generation sends the current user's profile to the model API", async () => {
  let requestBody;
  const fakeFetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return { choices: [{ message: { content: '["A useful reply"]' } }] };
      }
    };
  };
  const context = loadBackground(fakeFetch);
  const result = await context.generateReplies({
    apiKey: "test-key",
    provider: "deepseek",
    apiBaseUrl: "https://api.deepseek.com",
    apiMode: "chat",
    model: "deepseek-chat",
    tweetText: "AI agents are entering daily work.",
    replyType: "product_insight",
    count: 5,
    accountProfile: {
      profileMode: "product",
      productName: "AlphaLens",
      productSummary: "AI research for public-market investors",
      audience: "independent investors",
      coreValue: "reduce research blind spots",
      tone: "skeptical and concise"
    }
  });
  const sentPrompt = requestBody.messages[0].content;
  assert.match(sentPrompt, /AlphaLens/);
  assert.match(sentPrompt, /independent investors/);
  assert.match(sentPrompt, /reduce research blind spots/);
  assert.equal(result.profileEvidence.name, "AlphaLens");
  assert.equal(result.profileEvidence.personalized, true);
});

test("source URL validation allows public HTTPS and blocks local addresses", () => {
  const context = loadBackground();
  assert.equal(context.validatePublicSourceUrl("https://example.com/about"), "https://example.com/about");
  assert.throws(() => context.validatePublicSourceUrl("http://example.com"), /HTTPS/);
  assert.throws(() => context.validatePublicSourceUrl("https://localhost/profile"), /内网/);
  assert.throws(() => context.validatePublicSourceUrl("https://192.168.1.3/profile"), /内网/);
});

test("HTML extraction keeps public content and drops executable markup", () => {
  const context = loadBackground();
  const text = context.htmlToReadableText(`
    <html><head><title>AlphaLens</title>
    <meta name="description" content="AI research for investors">
    <style>.hidden { display:none }</style></head>
    <body><h1>Research with evidence</h1><script>ignore_previous_instructions()</script>
    <p>Every claim links back to a source.</p></body></html>
  `);
  assert.match(text, /AI research for investors/);
  assert.match(text, /Every claim links back to a source/);
  assert.doesNotMatch(text, /ignore_previous_instructions/);
  assert.doesNotMatch(text, /display:none/);
});

test("profile import reads a website and returns structured fields", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url === "https://alphalens.example/about") {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html; charset=utf-8" },
        async text() {
          return '<html><head><title>AlphaLens</title><meta name="description" content="AI research for investors"></head><body>Every claim links to evidence.</body></html>';
        }
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: JSON.stringify({
          productName: "AlphaLens",
          productSummary: "AI research for investors",
          audience: "independent investors",
          positioning: "evidence-first research",
          coreValue: "reduce research blind spots"
        }) } }] };
      }
    };
  };
  const context = loadBackground(fakeFetch);
  const result = await context.importProfileFromSources({
    apiKey: "test-key",
    provider: "deepseek",
    apiBaseUrl: "https://api.deepseek.com",
    apiMode: "chat",
    model: "deepseek-chat",
    profileMode: "product",
    urls: ["https://alphalens.example/about"]
  });
  assert.equal(calls.length, 2);
  assert.equal(result.profile.productName, "AlphaLens");
  assert.equal(result.profile.audience, "independent investors");
  assert.equal(result.sources[0].ok, true);
  assert.equal("text" in result.sources[0], false);
  const modelPrompt = JSON.parse(calls[1].options.body).messages[0].content;
  assert.match(modelPrompt, /不可信资料/);
  assert.match(modelPrompt, /Every claim links to evidence/);
});

test("imported profile fills blank fields without overwriting manual input", () => {
  const { context, element } = loadOptions();
  element("productName").value = "My manually edited name";
  element("productSummary").value = "";
  const filled = context.applyImportedProfile({
    productName: "Imported name",
    productSummary: "Imported summary"
  });
  assert.equal(element("productName").value, "My manually edited name");
  assert.equal(element("productSummary").value, "Imported summary");
  assert.equal(filled, 1);
});

test("re-importing a persona refreshes its bio without replacing other manual fields", () => {
  const { context, element } = loadOptions();
  element("productName").value = "Manual product name";
  element("personaBio").value = "旧 Bio";
  const filled = context.applyImportedProfile({
    productName: "Imported product name",
    personaBio: "更新后的个人 Bio"
  });
  assert.equal(element("productName").value, "Manual product name");
  assert.equal(element("personaBio").value, "更新后的个人 Bio");
  assert.equal(filled, 1);
});
