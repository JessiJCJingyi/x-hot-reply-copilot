const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-opus-4.8";
const DEFAULT_IKUNCODE_MODEL = "claude-opus-4-6";

const DEFAULT_SETTINGS = {
  provider: "openai",
  profileMode: "product",
  productName: "",
  productUrl: "",
  socialUrl: "",
  sourceUrls: "",
  productSummary: "",
  audience: "",
  positioning: "",
  coreValue: "",
  useCases: "",
  differentiator: "",
  personaIdentity: "",
  personaBio: "",
  personaVoice: "",
  tone: "",
  mentionPolicy: "default",
  replyLanguage: "auto",
  bannedWords: "太强了、牛逼、颠覆、遥遥领先、闭眼冲、全网最强",
  apiBaseUrl: "https://api.openai.com/v1",
  apiMode: "responses",
  model: "gpt-4.1-mini"
};

const API_KEY_FIELD = "apiKey";
const DATA_CONSENT_FIELD = "dataConsentAccepted";

const PROVIDER_PRESETS = {
  ikuncode: {
    apiBaseUrl: "https://api.ikuncode.cc/v1",
    apiMode: "chat",
    model: DEFAULT_IKUNCODE_MODEL
  },
  openai: {
    apiBaseUrl: "https://api.openai.com/v1",
    apiMode: "responses",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    apiBaseUrl: "https://api.deepseek.com",
    apiMode: "chat",
    model: "deepseek-chat"
  },
  openrouter: {
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiMode: "chat",
    model: DEFAULT_OPENROUTER_MODEL
  },
  siliconflow: {
    apiBaseUrl: "https://api.siliconflow.cn/v1",
    apiMode: "chat",
    model: "deepseek-ai/DeepSeek-V3"
  },
  custom: {
    apiBaseUrl: "",
    apiMode: "chat",
    model: ""
  }
};

const fields = Object.keys(DEFAULT_SETTINGS);

document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("provider").addEventListener("change", applyProviderPreset);
document.getElementById("apiBaseUrl").addEventListener("change", syncProviderFromBaseUrl);
document.getElementById("apiBaseUrl").addEventListener("blur", syncProviderFromBaseUrl);
document.getElementById("importProfile").addEventListener("click", importProfileFromLinks);

async function load() {
  const settings = await readStoredSettings();
  normalizeProviderSettings(settings);
  for (const field of fields) {
    document.getElementById(field).value = settings[field] || "";
  }
  document.getElementById(API_KEY_FIELD).value = settings[API_KEY_FIELD] || "";
  document.getElementById("dataConsent").checked = Boolean(settings[DATA_CONSENT_FIELD]);
  syncModelState();
  showProviderDetection(settings.apiBaseUrl, settings.provider);
}

async function save() {
  syncProviderFromBaseUrl();
  const settings = {};
  for (const field of fields) {
    settings[field] = document.getElementById(field).value.trim();
  }
  normalizeProviderSettings(settings);
  const apiKey = document.getElementById(API_KEY_FIELD).value.trim();
  const dataConsentAccepted = document.getElementById("dataConsent").checked;
  if (apiKey && !dataConsentAccepted) {
    setStatus("使用模型 API 前，请先确认生成前的数据说明。");
    return;
  }
  if (!(await ensureHostAccess([settings.apiBaseUrl]))) {
    setStatus("未获得该 API 域名的访问权限，设置尚未保存。");
    return;
  }
  await chrome.storage.sync.set(settings);
  await chrome.storage.sync.remove(API_KEY_FIELD);
  await chrome.storage.local.set({ [API_KEY_FIELD]: apiKey, [DATA_CONSENT_FIELD]: dataConsentAccepted });
  await load();
  const profileCount = countProfileFields(settings);
  setStatus(`已保存。已识别 ${providerName(settings.provider)}，读取 ${profileCount} 个个性化字段。刷新 X 页面后生效。`);
}

async function reset() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  await chrome.storage.sync.remove(API_KEY_FIELD);
  await chrome.storage.local.remove([API_KEY_FIELD, DATA_CONSENT_FIELD]);
  await load();
  setStatus("已恢复默认设置。");
}

async function readStoredSettings() {
  const synced = await chrome.storage.sync.get({ ...DEFAULT_SETTINGS, [API_KEY_FIELD]: "" });
  const local = await chrome.storage.local.get({ [API_KEY_FIELD]: "", [DATA_CONSENT_FIELD]: false });
  const legacyKey = synced[API_KEY_FIELD] || "";
  const apiKey = local[API_KEY_FIELD] || legacyKey;
  if (!local[API_KEY_FIELD] && legacyKey) {
    await chrome.storage.local.set({ [API_KEY_FIELD]: legacyKey });
  }
  await chrome.storage.sync.remove(API_KEY_FIELD);
  delete synced[API_KEY_FIELD];
  return {
    ...DEFAULT_SETTINGS,
    ...synced,
    [API_KEY_FIELD]: apiKey,
    [DATA_CONSENT_FIELD]: Boolean(local[DATA_CONSENT_FIELD])
  };
}

function applyProviderPreset() {
  const provider = document.getElementById("provider").value;
  const preset = PROVIDER_PRESETS[provider];
  if (!preset) return;
  document.getElementById("apiBaseUrl").value = preset.apiBaseUrl;
  document.getElementById("apiMode").value = preset.apiMode;
  document.getElementById("model").value = preset.model;
  syncModelState();
  showProviderDetection(preset.apiBaseUrl, provider);
  setStatus("已填入供应商预设。API Key 需要使用该供应商自己的 key。");
}

function syncProviderFromBaseUrl() {
  const baseUrl = document.getElementById("apiBaseUrl").value.trim();
  const detected = detectProviderFromUrl(baseUrl);
  if (!detected) {
    document.getElementById("provider").value = "custom";
    syncModelState();
    showProviderDetection(baseUrl, "custom");
    return;
  }

  const providerField = document.getElementById("provider");
  const providerChanged = providerField.value !== detected;
  providerField.value = detected;
  const preset = PROVIDER_PRESETS[detected];
  document.getElementById("apiMode").value = preset.apiMode;
  if (providerChanged || !document.getElementById("model").value.trim()) {
    document.getElementById("model").value = preset.model;
  }
  syncModelState();
  showProviderDetection(baseUrl, detected);
}

function normalizeProviderSettings(settings) {
  const previousProvider = settings.provider;
  const detected = detectProviderFromUrl(settings.apiBaseUrl);
  if (detected) settings.provider = detected;
  const preset = PROVIDER_PRESETS[settings.provider];
  if (!preset) {
    settings.provider = "custom";
    settings.apiBaseUrl = "";
    settings.apiMode = "chat";
    settings.model = "";
    return;
  }
  if (detected && previousProvider !== detected) {
    settings.apiMode = preset.apiMode;
    settings.model = preset.model;
    return;
  }
  settings.apiMode = settings.apiMode || preset.apiMode;
  settings.model = settings.model || preset.model;
}

function detectProviderFromUrl(value) {
  const url = String(value || "").toLowerCase();
  if (url.includes("api.ikuncode.cc")) return "ikuncode";
  if (url.includes("openrouter.ai")) return "openrouter";
  if (url.includes("api.deepseek.com") || url.includes("deepseek.com")) return "deepseek";
  if (url.includes("api.openai.com") || url.includes("openai.com")) return "openai";
  if (url.includes("siliconflow.cn")) return "siliconflow";
  return "";
}

function syncModelState() {
  const provider = document.getElementById("provider").value;
  const modelField = document.getElementById("model");
  const modelLabel = document.getElementById("modelLabel");
  modelField.disabled = false;
  modelField.title = "";
  modelLabel.textContent = provider === "openrouter"
    ? "模型（OpenRouter 模型 ID）"
    : provider === "ikuncode"
      ? "模型（中转站模型 ID）"
      : "模型";
  modelField.placeholder = PROVIDER_PRESETS[provider]?.model || "输入模型 ID";
}

function showProviderDetection(baseUrl, provider) {
  const hint = document.getElementById("providerHint");
  if (!baseUrl) {
    hint.textContent = "填写 API Base URL 后自动识别供应商；自建网关请选“自定义兼容接口”。";
    return;
  }
  hint.textContent = provider === "custom"
    ? "未识别到标准供应商域名，已按自定义兼容接口处理。"
    : `已根据 API Base URL 识别为 ${providerName(provider)}。`;
}

function providerName(provider) {
  return {
    ikuncode: "IKunCode 中转站",
    openai: "OpenAI",
    deepseek: "DeepSeek",
    openrouter: "OpenRouter",
    siliconflow: "SiliconFlow",
    custom: "自定义兼容接口"
  }[provider] || provider;
}

function countProfileFields(settings) {
  return [
    "productName", "productUrl", "socialUrl", "productSummary", "audience",
    "positioning", "coreValue", "useCases", "differentiator", "personaIdentity", "personaBio",
    "personaVoice", "tone", "bannedWords"
  ].filter((field) => String(settings[field] || "").trim()).length;
}

async function importProfileFromLinks() {
  const button = document.getElementById("importProfile");
  const payload = {
    profileMode: document.getElementById("profileMode").value,
    productUrl: document.getElementById("productUrl").value.trim(),
    socialUrl: document.getElementById("socialUrl").value.trim(),
    sourceUrls: document.getElementById("sourceUrls").value,
    apiKey: document.getElementById("apiKey").value.trim(),
    provider: document.getElementById("provider").value,
    apiBaseUrl: document.getElementById("apiBaseUrl").value.trim(),
    apiMode: document.getElementById("apiMode").value,
    model: document.getElementById("model").value.trim()
  };
  const urls = collectSourceUrls(payload);
  if (!urls.length) {
    setStatus("请先填写官网、社媒主页或资料来源链接。");
    return;
  }
  if (!payload.apiKey) {
    setStatus("读取链接并整理资料需要先配置 API Key。");
    return;
  }
  if (!document.getElementById("dataConsent").checked) {
    setStatus("读取资料前，请先确认生成前的数据说明。");
    return;
  }
  if (!(await ensureHostAccess([payload.apiBaseUrl, ...urls]))) {
    setStatus("未获得所选资料或 API 域名的访问权限，未读取任何内容。");
    return;
  }

  button.disabled = true;
  button.textContent = "正在读取...";
  setStatus(`正在读取 ${urls.length} 个公开链接，请稍候。`);
  chrome.runtime.sendMessage({ type: "IMPORT_PROFILE", payload: { ...payload, urls } }, (response) => {
    button.disabled = false;
    button.textContent = "读取链接并补全资料";
    if (chrome.runtime.lastError) {
      setStatus(`读取失败：${chrome.runtime.lastError.message}`);
      return;
    }
    if (!response?.ok) {
      setStatus(response?.error || "读取资料失败。");
      return;
    }
    const filled = applyImportedProfile(response.data.profile);
    const succeeded = response.data.sources.filter((source) => source.ok).length;
    const failedSources = response.data.sources.filter((source) => !source.ok);
    const failed = failedSources.length;
    const failureDetails = failedSources
      .slice(0, 2)
      .map((source) => `${shortSourceName(source.url)}：${source.error}`)
      .join("；");
    const failureText = failed ? `，${failed} 个链接未能读取（${failureDetails}）` : "";
    setStatus(`已从 ${succeeded} 个链接提取资料，补全 ${filled} 个空字段${failureText}。请检查后点保存。`);
  });
}

async function ensureHostAccess(urls) {
  const origins = Array.from(new Set(urls.map(toOriginPattern).filter(Boolean)));
  if (!origins.length) return true;
  const missing = [];
  for (const origin of origins) {
    if (!(await chrome.permissions.contains({ origins: [origin] }))) missing.push(origin);
  }
  if (!missing.length) return true;
  return chrome.permissions.request({ origins: missing });
}

function toOriginPattern(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? `${url.origin}/*` : "";
  } catch (_) {
    return "";
  }
}

function collectSourceUrls(settings) {
  return [
    settings.productUrl,
    settings.socialUrl,
    ...String(settings.sourceUrls || "").split(/\n+/)
  ]
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, 5);
}

function shortSourceName(value) {
  try {
    return new URL(value).hostname;
  } catch (_) {
    return String(value).slice(0, 36);
  }
}

function applyImportedProfile(profile) {
  const importableFields = [
    "productName", "productSummary", "audience", "positioning", "coreValue",
    "useCases", "differentiator", "personaIdentity", "personaBio", "personaVoice", "tone", "bannedWords"
  ];
  let filled = 0;
  const refreshableFields = new Set(["personaBio"]);
  for (const field of importableFields) {
    const value = String(profile?.[field] || "").trim();
    const input = document.getElementById(field);
    if (!value || (input.value.trim() && !refreshableFields.has(field))) continue;
    if (input.value.trim() === value) continue;
    input.value = value;
    filled += 1;
  }
  return filled;
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}
