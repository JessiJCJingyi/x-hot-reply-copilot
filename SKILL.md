---
name: x-hot-reply-copilot
description: Product-account X/Twitter growth workflow for finding hot posts and generating high-quality, human-sounding replies that add value before mentioning the product. Use when building or operating an X reply workflow for product accounts, founders, SaaS tools, AI products, or official brand accounts.
---

# X Hot Reply Copilot

Use this skill to help product accounts find high-opportunity X posts and draft replies that can earn visibility without sounding like ads.

## Product Intent

Help product accounts answer:

- Which X posts are worth replying to right now?
- What should we say under this post?
- Can we connect this reply to our product value without sounding promotional?
- Which replies actually earn views and engagement?

## Default Flow

1. Scan recent visible X posts.
2. Rank posts by reply opportunity.
3. Select a high-potential post.
4. Read the original post carefully.
5. Compare the post to the product profile.
6. Choose the safest reply mode.
7. Generate reply candidates.
8. Let the user manually choose and publish.
9. Record results for learning.

## Reply Opportunity Factors

Use these factors directionally:

- Freshness: recent posts are usually better reply opportunities.
- Visible traction: views, likes, replies, reposts, and bookmarks when available.
- Author leverage: known founders, product leaders, AI builders, investors, and large accounts may deserve extra attention.
- Conversation fit: posts where the account can add a specific useful point.
- Product fit: posts related to the product's users, pain points, workflow, category, or worldview.
- Reply window: posts that are rising but not yet overcrowded.

Do not treat this as an exact analytics system unless the underlying data source is reliable.

## Reply Modes

### Add Value

Use when the product fit is weak or uncertain.

Rules:

- Do not mention the product.
- Do not mention the company.
- Do not link.
- Add a specific useful point.
- Keep it short and human.

### Builder Lens

Use when the post touches product building, workflow, users, AI tools, SaaS, or founder problems.

Rules:

- Speak from a builder or product-team perspective.
- Do not name the product.
- Do not fabricate metrics.
- Do not turn the reply into a pitch.

### Relevant Mention

Use only when the post is strongly connected to the product category, user pain, or use case.

Rules:

- Product mention should be contextual and light.
- The useful point comes first.
- No hard CTA by default.
- No exaggerated claims.

### Direct CTA

Use only when the original post explicitly asks for tools, recommendations, demos, or solutions.

Rules:

- Be transparent that this is your product.
- Keep the CTA short.
- Do not pretend to be an unrelated third-party recommender.
- Do not use this mode in automation.

## Quality Checklist

Before presenting replies, check:

- Does it respond to the actual post?
- Does it avoid generic agreement?
- Does it avoid AI-sounding phrasing?
- Does it avoid fake numbers or fake customer stories?
- Does it avoid forced product promotion?
- Is it short enough for X?
- Would a real human plausibly write it?

## Non-Goals

Do not:

- auto-publish replies
- mass-comment
- bypass platform safeguards
- scrape private data
- impersonate users
- fabricate social proof
- generate unrelated promotional replies

## Output Shape

When generating replies, provide:

- 3-10 reply candidates
- a reply mode label for each candidate
- a short note on why the best 1-2 candidates are strongest
- a warning if the post is a poor fit for product mention

