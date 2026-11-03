# X Hot Reply Copilot

Chrome extension for drafting Chinese X/Twitter replies that match an official WebApp product account tone.

## What It Does

- Reads the current X/Twitter post text.
- Generates Chinese reply drafts using the X growth skills logic:
  - valuable question
  - incremental supplement
  - scenario translation
  - restrained product-side perspective
- Lets you copy or insert a draft into the reply box.
- Imports product or persona context from public websites, social profiles, and portfolio pages.
- Uses a dedicated personal Bio in persona mode and includes it in reply personalization.
- Automatically scans newly loaded X posts and ranks a selectable Top 5 or Top 10 within the chosen time window.
- Collapses into a compact 48px launcher to keep the X timeline visible.
- Does not publish automatically.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Click `Load unpacked`.
4. Select the repository's `extension` folder.

## Configure

Open the extension options and set:

- API Key
- product name
- product URL
- audience
- positioning
- personal Bio (for persona mode)
- tone
- banned phrases

The API Base URL is used to detect IKunCode, OpenAI, DeepSeek, OpenRouter, or SiliconFlow automatically. The model remains editable.

```text
Default relay:
Provider = OpenAI
API Base URL = https://api.openai.com/v1
API mode = OpenAI Responses API
Model = gpt-4.1-mini
```

The API key is never bundled with the extension. Each user must enter their own provider key. It is stored only in `chrome.storage.local` on that device and is not placed in Chrome Sync.

Optional alternate providers:

```text
IKunCode:
Provider = IKunCode 中转站
API Base URL = https://api.ikuncode.cc/v1
API mode = OpenAI-compatible Chat API
Model = claude-opus-4-6

OpenAI:
Provider = OpenAI
API Base URL = https://api.openai.com/v1
API mode = OpenAI Responses API
Model = gpt-4.1-mini

DeepSeek:
Provider = DeepSeek
API Base URL = https://api.deepseek.com
API mode = OpenAI-compatible Chat API
Model = deepseek-chat

OpenRouter:
Provider = OpenRouter
API Base URL = https://openrouter.ai/api/v1
API mode = OpenAI-compatible Chat API
Model = anthropic/claude-opus-4.8

OpenRouter low-cost alternative:
Provider = OpenRouter
API Base URL = https://openrouter.ai/api/v1
API mode = OpenAI-compatible Chat API
Model = deepseek/deepseek-chat

SiliconFlow:
Provider = 硅基流动 SiliconFlow
API Base URL = https://api.siliconflow.cn/v1
API mode = OpenAI-compatible Chat API
Model = deepseek-ai/DeepSeek-V3
```

Without an API key, the extension uses local templates. With an API key, it generates contextual replies from the current post.

Each installation stores its API key locally and keeps non-secret profile settings in Chrome extension storage. Product and persona defaults are blank, so a new user does not inherit another user's brand information. Every generation refreshes the latest saved profile and reports how many profile fields were used.

## Import Product Or Persona Context

1. Add a product website, social profile, portfolio, Notion page, or other public source URL.
2. Click `读取链接并补全资料`.
3. Review the extracted fields. Existing manual fields are not overwritten.
4. Click `保存` only after the profile looks accurate.

The importer reads at most five public HTTPS pages and does not retain raw page text. Sites that require login or block automated requests may not be readable; in that case, paste the relevant facts into the profile fields manually.

## Usage

1. Open `https://x.com`.
2. Click a target post.
3. Click `读取帖子`.
4. Pick a reply strategy.
5. Click `生成中文回复`.
6. Copy or insert a draft, then manually review and publish.

## Open Source Attribution

This extension includes adapted ideas, prompt patterns, and growth methodology inspired by the open-source project [kangarooking/X-growth-skills](https://github.com/kangarooking/X-growth-skills), which is licensed under the MIT License.

The original MIT License notice is included in `THIRD_PARTY_LICENSES/X-growth-skills-MIT-LICENSE.txt`, and additional attribution details are included in `THIRD_PARTY_NOTICES.md`.

AI-tone cleanup rules are adapted from [larashero3-dotcom/lieflat-less-ai-tone](https://github.com/larashero3-dotcom/lieflat-less-ai-tone), also under the MIT License. Its notice is included in `THIRD_PARTY_LICENSES/lieflat-less-ai-tone-MIT-LICENSE.txt`.

This extension is an independent project. It is not affiliated with, endorsed by, sponsored by, or officially maintained by kangarooking, KangarooKing, X, Twitter, OpenAI, OpenRouter, DeepSeek, IKunCode, or SiliconFlow.
