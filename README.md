# X Hot Reply Copilot

A product-account growth workflow for finding hot X posts and generating high-quality replies that sound human, useful, and non-spammy.

This repository contains the public-safe workflow and skill packaging for **X Hot Reply Copilot**. It is designed for product teams, founders, and official product accounts that want to participate in high-visibility X/Twitter conversations without sounding like bots or ads.

## What It Does

X Hot Reply Copilot helps product accounts:

- identify recent X posts with strong reply opportunity
- prioritize posts by freshness, visible traction, and reply timing
- generate product-aware reply candidates
- add value before mentioning the product
- avoid generic AI-sounding comments
- avoid spammy or misleading promotion
- manually choose, edit, and post replies

## Core Workflow

1. Open X/Twitter For You, Following, Search, Profile, or List pages.
2. Scan visible posts from the last 1h / 3h / 6h / 12h.
3. Rank posts by reply opportunity.
4. Select a high-potential post.
5. Read the post content and visible metrics.
6. Generate reply candidates using the product profile.
7. Choose one reply manually.
8. Copy or insert the reply.
9. Track which replies earn views and engagement.

## Reply Modes

### Add Value

Contribute a useful point without mentioning the product.

Use this for most replies. The reply should stand on its own even if the reader has no idea what product is behind the account.

### Builder Lens

Respond from a product-builder perspective without naming the product.

Use this when the original post discusses product design, workflow, users, retention, onboarding, AI tools, SaaS, or building in public.

### Relevant Mention

Lightly connect the reply to the product when the original post is highly relevant.

The product is context, not the main character. No hard selling.

### Direct CTA

Use only when the original post explicitly asks for tools, recommendations, or solutions.

This mode should never be triggered by default automation.

## Product Profile Inputs

A product account should provide:

- Product URL
- Product name
- One-line positioning
- Vision
- Mission
- Target users
- Core pain points
- Core features
- Use cases
- Differentiator
- Brand tone
- Banned claims
- Banned words
- Product mention policy

See [templates/product-profile.md](templates/product-profile.md).

## How To Use This Skill

This repository contains a public-safe Codex skill for planning and operating an X hot-post reply workflow.

Clone the repository:

```bash
git clone https://github.com/JessiJCJingyi/x-hot-reply-copilot
```

Then use `SKILL.md` as a custom Codex skill, or reference this repository when asking an AI coding/product agent to help with X product-account growth.

Example prompts:

```text
Use x-hot-reply-copilot to design a 7-day X reply experiment for my AI product.
```

```text
Use x-hot-reply-copilot to review this X post and generate 5 product-account replies.
```

```text
Use x-hot-reply-copilot to build a weekly workflow for finding hot X posts and replying as a product account.
```

Before using it, fill out:

- Product URL
- Product name
- One-line positioning
- Vision
- Mission
- Target users
- Core pain points
- Core features
- Use cases
- Brand tone
- Banned claims
- Banned words

Best use cases:

- plan an X reply growth workflow
- evaluate which posts are worth replying to
- generate product-account reply candidates
- design a 7-day reply experiment
- turn reply learnings into a weekly operating system

This skill is best used as a planning, drafting, and workflow assistant. It does not auto-publish replies and should keep a human in the loop.

## Safety Principles

- Do not auto-publish.
- Do not mass-comment.
- Do not pretend to be a third-party user recommending your own product.
- Do not fabricate metrics, customer stories, or personal experience.
- Do not force product mentions into unrelated posts.
- Default to value-first replies.
- Keep the human in the loop.

## Suggested Success Metrics

- Replies generated per day
- Replies posted per day
- Average 24h views per reply
- Reply engagement rate
- Copy / insert rate
- User-rated reply quality
- Percentage of replies requiring no major edit

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

## Public-Safe Scope

This repository intentionally contains only the public-safe workflow and skill packaging.

It does **not** include:

- private commercial prompts
- validated high-performing reply examples
- proprietary scoring weights
- private product analytics
- third-party private extension code
- API keys or credentials

## Status

Early product workflow. Use this as a starting point for product-account growth experiments, not as a fully automated posting system.

## Product Website And Store Launch

- Website source: [`docs/`](docs/)
- Chrome Web Store listing draft: [`store/listing-zh-CN.md`](store/listing-zh-CN.md)
- Privacy disclosure draft: [`store/privacy-disclosure.md`](store/privacy-disclosure.md)
- Release checklist: [`store/release-checklist.md`](store/release-checklist.md)

The website is a static GitHub Pages-ready build. Before public release, enable Pages for the repository and complete every P0 item in the release checklist.
