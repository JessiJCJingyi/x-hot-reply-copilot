const SUPPORTED_PROVIDERS = new Set(["ikuncode", "openai", "deepseek", "openrouter", "siliconflow", "custom"]);

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

const DEFAULT_PANEL_SIZE = {
  width: 360,
  height: 520
};
const DEFAULT_LAUNCHER_POSITION = null;

const DEFAULT_HOT_WINDOW_HOURS = 12;
const HOT_POST_LIMIT = 10;

let state = {
  settings: { ...DEFAULT_SETTINGS },
  panelSize: { ...DEFAULT_PANEL_SIZE },
  hotWindowHours: DEFAULT_HOT_WINDOW_HOURS,
  hotPostLimit: HOT_POST_LIMIT,
  hotPosts: [],
  dataFeaturesStarted: false,
  autoScanStartupTimer: null,
  autoScanTimer: null,
  autoScanObserver: null,
  scanDebounceTimer: null,
  currentPath: location.pathname,
  launcherPosition: DEFAULT_LAUNCHER_POSITION,
  suppressToggleClick: false,
  selectedTweet: "",
  replies: [],
  inserting: false
};

init();

async function init() {
  await refreshSettings();
  const localSettings = await chrome.storage.local.get({ ...DEFAULT_PANEL_SIZE, launcherPosition: DEFAULT_LAUNCHER_POSITION });
  state.panelSize = { width: localSettings.width, height: localSettings.height };
  state.launcherPosition = localSettings.launcherPosition;
  injectPanel();
  applyPanelSize();
  subscribeSettingsChanges();
  if (state.settings[DATA_CONSENT_FIELD]) {
    startDataFeatures();
  } else {
    setStatus("使用前请打开设置，阅读数据说明并确认后启用。");
    renderHotPosts();
  }
}

async function refreshSettings() {
  const synced = await chrome.storage.sync.get({ ...DEFAULT_SETTINGS, [API_KEY_FIELD]: "" });
  const local = await chrome.storage.local.get({ [API_KEY_FIELD]: "", [DATA_CONSENT_FIELD]: false });
  const legacyKey = synced[API_KEY_FIELD] || "";
  const storedApiKey = local[API_KEY_FIELD] || legacyKey;
  if (!local[API_KEY_FIELD] && legacyKey) {
    await chrome.storage.local.set({ [API_KEY_FIELD]: legacyKey });
  }
  await chrome.storage.sync.remove(API_KEY_FIELD);
  delete synced[API_KEY_FIELD];
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...synced,
    [API_KEY_FIELD]: local[DATA_CONSENT_FIELD] ? storedApiKey : "",
    [DATA_CONSENT_FIELD]: Boolean(local[DATA_CONSENT_FIELD])
  };
  if (!SUPPORTED_PROVIDERS.has(state.settings.provider)) {
    state.settings = {
      ...state.settings,
      provider: "custom",
      apiBaseUrl: "",
      apiMode: "chat",
      model: ""
    };
  }
  renderProfileSummary();
  return state.settings;
}

function subscribeSettingsChanges() {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local" && (changes[API_KEY_FIELD] || changes[DATA_CONSENT_FIELD])) {
      const local = await chrome.storage.local.get({ [API_KEY_FIELD]: "", [DATA_CONSENT_FIELD]: false });
      state.settings[API_KEY_FIELD] = local[DATA_CONSENT_FIELD] ? local[API_KEY_FIELD] : "";
      state.settings[DATA_CONSENT_FIELD] = Boolean(local[DATA_CONSENT_FIELD]);
      if (state.settings[DATA_CONSENT_FIELD]) startDataFeatures();
      else stopDataFeatures();
    } else if (areaName === "sync" && Object.keys(DEFAULT_SETTINGS).some((field) => changes[field])) {
      for (const field of Object.keys(DEFAULT_SETTINGS)) {
        state.settings[field] = changes[field]?.newValue ?? state.settings[field] ?? DEFAULT_SETTINGS[field];
      }
    } else {
      return;
    }
    renderProfileSummary();
    setStatus("已加载新的产品/人设配置。");
  });
}

function injectPanel() {
  if (document.getElementById("xgra-panel")) return;
  const panel = document.createElement("section");
  panel.id = "xgra-panel";
  panel.innerHTML = `
    <div class="xgra-header">
      <div class="xgra-title">X 回复助手</div>
      <div class="xgra-header-actions">
        <button class="xgra-icon" data-action="options" title="设置">⚙</button>
        <button class="xgra-icon" data-action="toggle" title="收起">−</button>
      </div>
    </div>
    <div class="xgra-body">
      <div class="xgra-profile" data-role="profile-summary"></div>
      <div class="xgra-row">
        <select data-role="reply-type" title="回复类型">
          <option value="auto">自动推荐</option>
          <option value="pure_value">Pure Value</option>
          <option value="product_insight">Product Insight</option>
          <option value="soft_mention">Soft Mention</option>
          <option value="direct_plug">Direct Plug</option>
        </select>
        <select data-role="count" title="生成数量">
          <option value="5">5条</option>
          <option value="10">10条</option>
        </select>
        <button data-action="read">读取帖子</button>
      </div>
      <div class="xgra-hot-panel">
        <div class="xgra-hot-head">
          <strong>热帖雷达</strong>
          <div class="xgra-hot-controls">
            <select data-role="hot-limit" title="榜单数量">
              <option value="5">Top 5</option>
              <option value="10" selected>Top 10</option>
            </select>
            <select data-role="hot-window" title="发布时间窗口">
              <option value="1">1 小时</option>
              <option value="3">3 小时</option>
              <option value="6">6 小时</option>
              <option value="12" selected>12 小时</option>
            </select>
            <button data-action="scan-hot" title="立即重新扫描">扫描</button>
          </div>
        </div>
        <div class="xgra-hot-list" data-role="hot-list">
          正在自动扫描当前页面的热帖…
        </div>
      </div>
      <div class="xgra-tweet" data-role="tweet">点击一条帖子，或打开帖子详情页后点“读取帖子”。</div>
      <div class="xgra-actions">
        <button class="xgra-primary" data-action="generate">生成中文回复</button>
        <button data-action="clear">清空</button>
      </div>
      <div class="xgra-status" data-role="status"></div>
      <div data-role="replies"></div>
      <div class="xgra-small">只生成草稿，不自动发布。复制或插入后请人工检查。</div>
    </div>
    <div class="xgra-resize xgra-resize-left" data-resize-direction="left" title="拖动调整宽度"></div>
    <div class="xgra-resize xgra-resize-top" data-resize-direction="top" title="拖动调整高度"></div>
    <div class="xgra-resize xgra-resize-corner" data-resize-direction="corner" title="拖动调整面板大小"></div>
  `;
  document.documentElement.appendChild(panel);
  panel.addEventListener("click", handlePanelClick);
  panel.addEventListener("change", handlePanelChange);
  setupResize(panel);
  setupLauncherDrag(panel);
  renderProfileSummary();
}

function handlePanelClick(event) {
  const actionElement = event.target?.closest?.("[data-action]");
  const action = actionElement?.dataset?.action;
  if (!action) return;
  if (action === "toggle") {
    if (state.suppressToggleClick) {
      state.suppressToggleClick = false;
      return;
    }
    const panel = document.getElementById("xgra-panel");
    panel.classList.toggle("xgra-collapsed");
    const collapsed = panel.classList.contains("xgra-collapsed");
    actionElement.textContent = collapsed ? "+" : "−";
    actionElement.title = collapsed ? "展开回复助手" : "收起为小图标";
    actionElement.setAttribute("aria-label", actionElement.title);
    applyLauncherPosition();
  }
  if (action === "options") chrome.runtime.openOptionsPage();
  const dataActions = new Set(["read", "generate", "scan-hot", "select-hot"]);
  if (dataActions.has(action) && !state.settings[DATA_CONSENT_FIELD]) {
    setStatus("请先在设置中阅读数据说明并确认。");
    chrome.runtime.openOptionsPage();
    return;
  }
  if (action === "read") readCurrentTweet();
  if (action === "generate") generateReplies();
  if (action === "scan-hot") scanHotPosts({ announce: true });
  if (action === "select-hot") selectHotPost(actionElement.dataset.hotId);
  if (action === "clear") {
    state.selectedTweet = "";
    state.replies = [];
    render();
  }
  if (action === "copy") copyReply(Number(actionElement.dataset.index));
  if (action === "insert") insertReply(Number(actionElement.dataset.index), actionElement);
}

function handlePanelChange(event) {
  const role = event.target?.dataset?.role;
  if ((role === "hot-window" || role === "hot-limit") && !state.settings[DATA_CONSENT_FIELD]) {
    setStatus("请先在设置中阅读数据说明并确认。");
    return;
  }
  if (role === "hot-window") {
    state.hotWindowHours = Number(event.target.value) || DEFAULT_HOT_WINDOW_HOURS;
    scanHotPosts({ announce: true });
  }
  if (role === "hot-limit") {
    state.hotPostLimit = Number(event.target.value) === 5 ? 5 : HOT_POST_LIMIT;
    scanHotPosts({ announce: true });
  }
}

function rememberClickedTweet(event) {
  const article = event.target?.closest?.("article");
  if (!article) return;
  const text = extractTweetText(article);
  if (text) {
    state.selectedTweet = text;
    renderTweet();
  }
}

function readCurrentTweet() {
  const focusedArticle = document.activeElement?.closest?.("article");
  const articles = Array.from(document.querySelectorAll("article"));
  const candidates = [focusedArticle, ...articles].filter(Boolean);
  const tweet = candidates.map(extractTweetText).find(Boolean);
  state.selectedTweet = tweet || state.selectedTweet || "";
  setStatus(tweet ? "已读取当前帖子。" : "没有读到帖子。请先点击目标帖子正文。");
  renderTweet();
}

function extractTweetText(article) {
  const tweetTextNodes = Array.from(article.querySelectorAll('[data-testid="tweetText"]'));
  const text = tweetTextNodes
    .map((node) => node.innerText)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return "";
  return text.length > 1800 ? text.slice(0, 1800) : text;
}

async function generateReplies() {
  await refreshSettings();
  if (!state.selectedTweet) readCurrentTweet();
  if (!state.selectedTweet) {
    setStatus("缺少帖子内容。");
    return;
  }
  const replyType = document.querySelector('#xgra-panel [data-role="reply-type"]').value;
  const count = Number(document.querySelector('#xgra-panel [data-role="count"]').value) || 5;
  setStatus("正在生成...");
  const payload = {
    tweetText: state.selectedTweet,
    accountProfile: pickProfile(state.settings),
    apiKey: state.settings.apiKey,
    provider: state.settings.provider,
    apiBaseUrl: state.settings.apiBaseUrl,
    apiMode: state.settings.apiMode,
    model: state.settings.model,
    replyType,
    count
  };
  chrome.runtime.sendMessage({ type: "GENERATE_REPLIES", payload }, (response) => {
    if (!response?.ok) {
      setStatus(response?.error || "生成失败。");
      return;
    }
    state.replies = response.data.replies || [];
    const profileMessage = formatProfileEvidence(response.data.profileEvidence);
    if (response.data.warning) {
      setStatus(`${response.data.warning}${profileMessage}`);
    } else {
      const sourceMessage = response.data.source === "local"
        ? "已生成。来源：本地模板，配置 API Key 后质量更高。"
        : `已生成。模型：${response.data.model || "未返回"}。`;
      setStatus(`${sourceMessage}${profileMessage}`);
    }
    renderReplies();
  });
}

function formatProfileEvidence(evidence) {
  if (!evidence) return "";
  if (!evidence.personalized) return " 当前个性化资料不足，回复可能偏通用。";
  const stylePack = evidence.stylePack ? `，并启用${evidence.stylePack}` : "";
  return ` 已使用“${evidence.name}”的 ${evidence.anchorCount} 个个性化字段${stylePack}。`;
}

function scanHotPosts({ announce = false } = {}) {
  const articles = Array.from(document.querySelectorAll("article"));
  const seen = new Set();
  const hotPosts = [];

  clearInlineBadges(articles);
  for (const article of articles) {
    const post = extractHotPost(article);
    if (!post || seen.has(post.id)) continue;
    seen.add(post.id);
    if (post.ageHours !== null && post.ageHours > state.hotWindowHours) continue;
    hotPosts.push(post);
  }

  state.hotPosts = hotPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, state.hotPostLimit);

  renderInlineBadges(hotPosts);
  renderHotPosts();
  if (announce) {
    setStatus(state.hotPosts.length ? `已找到 ${state.hotPosts.length} 条候选热帖。` : "当前页面没有读到时间窗口内的候选热帖。");
  }
}

function clearInlineBadges(articles) {
  for (const article of articles) {
    article.querySelector(":scope > .xgra-hot-badge")?.remove();
  }
}

function setupAutoHotScan() {
  if (state.autoScanStartupTimer) window.clearTimeout(state.autoScanStartupTimer);
  state.autoScanStartupTimer = window.setTimeout(() => {
    state.autoScanStartupTimer = null;
    scanHotPosts({ announce: true });
  }, 1200);
  state.autoScanObserver?.disconnect();
  state.autoScanObserver = new MutationObserver((mutations) => {
    const hasNewPosts = mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => (
      node.nodeType === Node.ELEMENT_NODE && (node.matches?.("article") || node.querySelector?.("article"))
    )));
    if (hasNewPosts) scheduleHotScan();
  });
  state.autoScanObserver.observe(document.body, { childList: true, subtree: true });
  if (state.autoScanTimer) window.clearInterval(state.autoScanTimer);
  state.autoScanTimer = window.setInterval(() => {
    if (location.pathname !== state.currentPath) {
      state.currentPath = location.pathname;
      state.hotPosts = [];
      renderHotPosts();
    }
    scheduleHotScan(150);
  }, 8000);
}

function startDataFeatures() {
  if (state.dataFeaturesStarted) return;
  state.dataFeaturesStarted = true;
  document.addEventListener("click", rememberClickedTweet, true);
  setupAutoHotScan();
  setStatus("已启用本地热帖扫描。");
}

function stopDataFeatures() {
  state.dataFeaturesStarted = false;
  document.removeEventListener("click", rememberClickedTweet, true);
  if (state.autoScanStartupTimer) window.clearTimeout(state.autoScanStartupTimer);
  if (state.autoScanTimer) window.clearInterval(state.autoScanTimer);
  if (state.scanDebounceTimer) window.clearTimeout(state.scanDebounceTimer);
  state.autoScanStartupTimer = null;
  state.autoScanTimer = null;
  state.scanDebounceTimer = null;
  state.autoScanObserver?.disconnect();
  state.autoScanObserver = null;
  clearInlineBadges(Array.from(document.querySelectorAll("article")));
  state.hotPosts = [];
  state.selectedTweet = "";
  state.replies = [];
  render();
  setStatus("已暂停页面读取。重新启用前不会扫描或读取帖子。");
}

function scheduleHotScan(delay = 500) {
  if (state.scanDebounceTimer) window.clearTimeout(state.scanDebounceTimer);
  state.scanDebounceTimer = window.setTimeout(() => {
    state.scanDebounceTimer = null;
    scanHotPosts();
  }, delay);
}

function extractHotPost(article) {
  const text = extractTweetText(article);
  if (!text) return null;

  const publishedAt = extractPublishedAt(article);
  const ageHours = publishedAt ? Math.max((Date.now() - publishedAt.getTime()) / 36e5, 0.05) : null;
  const metrics = extractMetrics(article);
  const author = extractAuthor(article);
  const href = extractPostHref(article);
  const id = href || `${author}|${text.slice(0, 80)}`;
  const score = scoreHotPost({ metrics, ageHours, text, author });

  return {
    id,
    href,
    article,
    text,
    author,
    ageHours,
    metrics,
    score
  };
}

function extractPublishedAt(article) {
  const time = article.querySelector("time[datetime]");
  const value = time?.getAttribute("datetime");
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractPostHref(article) {
  const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]'))
    .map((link) => link.getAttribute("href") || "")
    .find(Boolean);
  return statusLink || "";
}

function extractAuthor(article) {
  const links = Array.from(article.querySelectorAll('a[href^="/"]'));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.match(/^\/([A-Za-z0-9_]{1,20})$/);
    if (match) return `@${match[1]}`;
  }
  return "@unknown";
}

function extractMetrics(article) {
  const labels = getPrimaryMetricLabels(article);
  return {
    replies: extractMetric(labels, [/repl/i, /comment/i, /回复/, /评论/]),
    reposts: extractMetric(labels, [/repost/i, /retweet/i, /转发/, /转帖/, /转推/]),
    likes: extractMetric(labels, [/like/i, /喜欢/, /点赞/]),
    views: extractMetric(labels, [/view/i, /impression/i, /浏览/, /查看/, /观看/]),
    bookmarks: extractMetric(labels, [/bookmark/i, /save/i, /书签/, /收藏/])
  };
}

function getPrimaryMetricLabels(article) {
  const groups = Array.from(article.querySelectorAll('[role="group"]'));
  const primaryGroup = groups.find((group) => group.closest("article") === article) || article;
  return Array.from(primaryGroup.querySelectorAll("[aria-label]"))
    .map((node) => node.getAttribute("aria-label") || "")
    .filter(Boolean);
}

function extractMetric(labels, patterns) {
  for (const label of labels) {
    const parts = String(label).split(/[\n,，。·•]/).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (!patterns.some((pattern) => pattern.test(part))) continue;
      const match = part.replace(/,/g, "").match(/([\d.]+)\s*([KkMm万亿]?)/);
      if (match) return parseCompactNumber(`${match[1]}${match[2] || ""}`);
    }
  }
  return 0;
}

function parseCompactNumber(value) {
  const raw = String(value).trim();
  const number = Number.parseFloat(raw);
  if (Number.isNaN(number)) return 0;
  if (/[Kk]/.test(raw)) return Math.round(number * 1_000);
  if (/[Mm]/.test(raw)) return Math.round(number * 1_000_000);
  if (/万/.test(raw)) return Math.round(number * 10_000);
  if (/亿/.test(raw)) return Math.round(number * 100_000_000);
  return Math.round(number);
}

function scoreHotPost({ metrics, ageHours, text, author }) {
  const hours = ageHours || state.hotWindowHours || DEFAULT_HOT_WINDOW_HOURS;
  const viewsPerHour = metrics.views ? metrics.views / hours : 0;
  const engagement = metrics.likes + metrics.reposts * 2 + metrics.replies * 3 + metrics.bookmarks * 2;
  const engagementPerHour = engagement / hours;
  const freshness = ageHours === null ? 10 : Math.max(0, 30 - ageHours * 2.5);
  const authorBoost = isLikelyInfluencer(author, metrics) ? 20 : 0;
  const textBoost = text.length > 40 ? 8 : 0;

  return Math.round(
    Math.log10(viewsPerHour + 1) * 28 +
    Math.log10(engagementPerHour + 1) * 22 +
    freshness +
    authorBoost +
    textBoost
  );
}

function viewsPerHour(post) {
  if (!post.metrics.views) return 0;
  const hours = post.ageHours || state.hotWindowHours || DEFAULT_HOT_WINDOW_HOURS;
  return Math.round(post.metrics.views / Math.max(hours, 0.05));
}

function renderInlineBadges(posts) {
  for (const post of posts) {
    ensureArticlePosition(post.article);
    let badge = post.article.querySelector(":scope > .xgra-hot-badge");
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.className = "xgra-hot-badge";
      badge.title = "热帖雷达评分";
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateHotPost(post, { scroll: true, generate: true });
      });
      post.article.appendChild(badge);
    }
    const vph = viewsPerHour(post);
    badge.className = `xgra-hot-badge ${hotBadgeLevel(vph, post.score)}`;
    badge.textContent = `${hotBadgeIcon(vph, post.score)} ${vph ? `${formatNumber(vph)}/h` : `S${post.score}`}`;
  }
}

function ensureArticlePosition(article) {
  const current = window.getComputedStyle(article).position;
  if (current === "static") article.style.position = "relative";
}

function hotBadgeLevel(vph, score) {
  if (vph >= 10_000 || score >= 150) return "xgra-hot-badge-fire";
  if (vph >= 1_000 || score >= 100) return "xgra-hot-badge-warm";
  return "xgra-hot-badge-fresh";
}

function hotBadgeIcon(vph, score) {
  if (vph >= 10_000 || score >= 150) return "🔥";
  if (vph >= 1_000 || score >= 100) return "🚀";
  return "🌱";
}

function isLikelyInfluencer(author, metrics) {
  const watched = ["@sama", "@openai", "@gdb", "@elonmusk", "@paulg", "@ycombinator", "@karpathy", "@naval"];
  return watched.includes(String(author).toLowerCase()) || metrics.views >= 50_000 || metrics.likes >= 800;
}

function selectHotPost(id) {
  const post = state.hotPosts.find((item) => item.id === id);
  if (!post) return;
  activateHotPost(post, { scroll: true, generate: true });
}

function activateHotPost(post, { scroll = false, generate = false } = {}) {
  state.selectedTweet = post.text;
  renderTweet();
  if (scroll) {
    post.article.scrollIntoView({ behavior: "smooth", block: "center" });
    post.article.classList.add("xgra-hot-selected");
    window.setTimeout(() => post.article.classList.remove("xgra-hot-selected"), 1400);
  }
  setStatus(`已选择热帖 ${post.author}，正在生成回复...`);
  if (generate) {
    window.setTimeout(() => generateReplies(), 450);
  }
}

function pickProfile(settings) {
  return {
    profileMode: settings.profileMode,
    productName: settings.productName,
    productUrl: settings.productUrl,
    socialUrl: settings.socialUrl,
    sourceUrls: settings.sourceUrls,
    productSummary: settings.productSummary,
    audience: settings.audience,
    positioning: settings.positioning,
    coreValue: settings.coreValue,
    useCases: settings.useCases,
    differentiator: settings.differentiator,
    personaIdentity: settings.personaIdentity,
    personaBio: settings.personaBio,
    personaVoice: settings.personaVoice,
    tone: settings.tone,
    mentionPolicy: settings.mentionPolicy,
    replyLanguage: "zh",
    bannedWords: settings.bannedWords
  };
}

async function copyReply(index) {
  const reply = state.replies[index];
  if (!reply) return;
  await navigator.clipboard.writeText(reply);
  setStatus("已复制。");
}

async function insertReply(index, button) {
  const reply = state.replies[index];
  if (!reply || state.inserting) return;
  const editor = findReplyEditor();
  if (!editor) {
    await copyReply(index);
    setStatus("未找到回复框，已复制。");
    return;
  }
  if (hasSameReply(editor, reply)) {
    setStatus("回复框里已有这条内容，未重复插入。");
    return;
  }
  state.inserting = true;
  if (button) button.disabled = true;
  let copied = false;
  try {
    await navigator.clipboard.writeText(reply);
    copied = true;
  } catch (_) {
    // The synthetic paste can still work when clipboard permission is unavailable.
  }
  dispatchPasteToEditor(editor, reply);
  await waitForEditorUpdate();
  if (hasSameReply(editor, reply)) {
    setStatus("已插入回复框，可以继续删除或修改后发布。");
  } else if (copied) {
    setStatus("X 没有接受自动插入，回复已复制。请在回复框按 Cmd+V 粘贴，可正常编辑。");
  } else {
    setStatus("X 没有接受自动插入，请使用“复制”后手动粘贴。");
  }
  state.inserting = false;
  if (button) button.disabled = false;
}

function findReplyEditor() {
  const editors = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"], [role="textbox"][contenteditable="true"]'));
  return editors.find((editor) => editor.offsetParent !== null) || editors[0];
}

function hasSameReply(editor, reply) {
  return normalizeText(editor.innerText || editor.textContent || "").includes(normalizeText(reply));
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function dispatchPasteToEditor(editor, text) {
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData
  });
  editor.focus();
  return editor.dispatchEvent(pasteEvent);
}

function waitForEditorUpdate(delay = 160) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function render() {
  renderProfileSummary();
  renderTweet();
  renderReplies();
  renderHotPosts();
}

function renderProfileSummary() {
  const node = document.querySelector('#xgra-panel [data-role="profile-summary"]');
  if (!node) return;
  const isPersona = state.settings.profileMode === "persona";
  const mode = isPersona ? "个人号" : "产品官号";
  const name = isPersona
    ? state.settings.personaIdentity || state.settings.productName || "未填写人设"
    : state.settings.productName || "未填写产品";
  const summary = isPersona
    ? state.settings.personaBio || state.settings.productSummary || state.settings.personaIdentity || "打开设置补充个人简介"
    : state.settings.productSummary || state.settings.positioning || "打开设置补充产品信息";
  const summaryLabel = isPersona ? `Bio · ${summary}` : summary;
  node.innerHTML = `
    <span class="xgra-profile-type">${escapeHtml(mode)}</span>
    <span class="xgra-profile-name">${escapeHtml(shorten(name, 36))}</span>
    <span class="xgra-profile-desc" title="${escapeHtml(summary)}">${escapeHtml(shorten(summaryLabel, 110))}</span>
  `;
}

function renderTweet() {
  const node = document.querySelector('#xgra-panel [data-role="tweet"]');
  if (node) node.textContent = state.selectedTweet || "点击一条帖子，或打开帖子详情页后点“读取帖子”。";
}

function renderReplies() {
  const container = document.querySelector('#xgra-panel [data-role="replies"]');
  if (!container) return;
  container.innerHTML = state.replies
    .map((reply, index) => `
      <div class="xgra-reply">
        <div class="xgra-reply-text">${escapeHtml(reply)}</div>
        <div class="xgra-reply-actions">
          <button data-action="copy" data-index="${index}">复制</button>
          <button data-action="insert" data-index="${index}">插入</button>
        </div>
      </div>
    `)
    .join("");
}

function renderHotPosts() {
  const container = document.querySelector('#xgra-panel [data-role="hot-list"]');
  if (!container) return;
  if (!state.settings[DATA_CONSENT_FIELD]) {
    container.textContent = "确认数据说明后启用本地热帖扫描。";
    return;
  }
  if (!state.hotPosts.length) {
    container.textContent = `正在自动扫描当前页面；加载到帖子后会展示 Top${state.hotPostLimit}。`;
    return;
  }

  container.innerHTML = state.hotPosts
    .map((post, index) => `
      <button class="xgra-hot-item" data-action="select-hot" data-hot-id="${escapeHtml(post.id)}">
        <span class="xgra-hot-rank">#${index + 1}</span>
        <span class="xgra-hot-main">
          <span class="xgra-hot-meta">
            <strong>${escapeHtml(post.author)}</strong>
            <span>${formatAge(post.ageHours)}</span>
            <span>${formatScore(post.score)}</span>
          </span>
          <span class="xgra-hot-text">${escapeHtml(shorten(post.text, 92))}</span>
          <span class="xgra-hot-stats">
            ${viewsPerHour(post) ? `${formatNumber(viewsPerHour(post))}/h` : "speed ?"}
            · ${post.metrics.views ? `${formatNumber(post.metrics.views)} views` : "views ?"}
            · ${formatNumber(post.metrics.likes)} likes
            · ${formatNumber(post.metrics.replies)} replies
          </span>
        </span>
      </button>
    `)
    .join("");
}

function setStatus(text) {
  const node = document.querySelector('#xgra-panel [data-role="status"]');
  if (node) node.textContent = text;
}

function formatAge(ageHours) {
  if (ageHours === null) return "时间未知";
  if (ageHours < 1) return `${Math.max(1, Math.round(ageHours * 60))}m`;
  return `${ageHours.toFixed(ageHours < 10 ? 1 : 0)}h`;
}

function formatScore(score) {
  return `score ${score}`;
}

function formatNumber(value) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

function shorten(text, maxLength) {
  const clean = normalizeText(text);
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyPanelSize() {
  const panel = document.getElementById("xgra-panel");
  if (!panel || window.matchMedia("(max-width: 520px)").matches) return;
  panel.style.width = `${state.panelSize.width}px`;
  panel.style.height = `${state.panelSize.height}px`;
}

function applyLauncherPosition() {
  const panel = document.getElementById("xgra-panel");
  if (!panel) return;
  if (!panel.classList.contains("xgra-collapsed") || !state.launcherPosition) {
    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("right");
    panel.style.removeProperty("bottom");
    return;
  }
  const x = clamp(Number(state.launcherPosition.x) || 8, 8, Math.max(8, window.innerWidth - 56));
  const y = clamp(Number(state.launcherPosition.y) || 8, 8, Math.max(8, window.innerHeight - 56));
  state.launcherPosition = { x, y };
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function setupLauncherDrag(panel) {
  const toggle = panel.querySelector('[data-action="toggle"]');
  if (!toggle) return;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let panelX = 0;
  let panelY = 0;

  toggle.addEventListener("pointerdown", (event) => {
    if (!panel.classList.contains("xgra-collapsed")) return;
    const rect = panel.getBoundingClientRect();
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    panelX = rect.left;
    panelY = rect.top;
    toggle.setPointerCapture(event.pointerId);
  });

  toggle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    moved = true;
    state.launcherPosition = {
      x: clamp(panelX + dx, 8, Math.max(8, window.innerWidth - 56)),
      y: clamp(panelY + dy, 8, Math.max(8, window.innerHeight - 56))
    };
    applyLauncherPosition();
  });

  toggle.addEventListener("pointerup", async (event) => {
    if (!dragging) return;
    dragging = false;
    toggle.releasePointerCapture(event.pointerId);
    if (!moved) return;
    state.suppressToggleClick = true;
    await chrome.storage.local.set({ launcherPosition: state.launcherPosition });
  });
}

function setupResize(panel) {
  const handles = Array.from(panel.querySelectorAll("[data-resize-direction]"));
  if (!handles.length) return;

  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let direction = "";

  for (const handle of handles) {
    handle.addEventListener("pointerdown", (event) => {
      if (window.matchMedia("(max-width: 520px)").matches) return;
      event.preventDefault();
      event.stopPropagation();
      direction = handle.dataset.resizeDirection || "";
      startX = event.clientX;
      startY = event.clientY;
      startWidth = panel.offsetWidth;
      startHeight = panel.offsetHeight;
      handle.setPointerCapture(event.pointerId);
      panel.classList.add("xgra-resizing");
    });

    handle.addEventListener("pointermove", (event) => {
      if (!panel.classList.contains("xgra-resizing")) return;
      const maxWidth = Math.max(320, window.innerWidth - 36);
      const maxHeight = Math.max(260, window.innerHeight - 36);
      const width = direction === "top"
        ? state.panelSize.width
        : clamp(startWidth + startX - event.clientX, 320, maxWidth);
      const height = direction === "left"
        ? state.panelSize.height
        : clamp(startHeight + startY - event.clientY, 260, maxHeight);
      state.panelSize = { width, height };
      applyPanelSize();
    });

    handle.addEventListener("pointerup", async (event) => {
      if (!panel.classList.contains("xgra-resizing")) return;
      panel.classList.remove("xgra-resizing");
      handle.releasePointerCapture(event.pointerId);
      await chrome.storage.local.set(state.panelSize);
    });
  }

  window.addEventListener("resize", () => {
    state.panelSize = {
      width: clamp(state.panelSize.width, 320, Math.max(320, window.innerWidth - 36)),
      height: clamp(state.panelSize.height, 260, Math.max(260, window.innerHeight - 36))
    };
    applyPanelSize();
    applyLauncherPosition();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
