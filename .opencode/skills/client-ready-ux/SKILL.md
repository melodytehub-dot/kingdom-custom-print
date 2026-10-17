---
name: client-ready-ux
description: Enforce polished, trustworthy, brand-appropriate, client-facing website copy and UX. Use for any UI component, page, feature, workflow, message, upload, image tool, error state, empty state, notification, or pre-release audit. Prevent internal implementation details, developer jargon, AI/provider names, and temporary build notes from leaking into customer-facing experiences.
license: MIT
compatibility: opencode
metadata:
  category: product-quality
  opencode/slash: "true"
---

# Client-Ready Website UX and Copy

## Mission

Build every user-facing surface as if it will be reviewed by a paying client and used by real customers today. The result should feel like a deliberately designed, professionally written product—not a code demo, AI prototype, developer dashboard, or work-in-progress.

Apply this skill whenever creating, updating, or reviewing any customer-facing experience. It covers existing screens as well as new changes.

## Non-negotiable rule: communicate outcomes, not implementation

Visible website content should explain **what users can do, what happened, and what to do next**. Do not describe **how we implemented it** unless that technical information is explicitly meaningful to the user's task or is required to be disclosed.

Never insert the following into public-facing UI merely because they appeared in a developer prompt or implementation plan:
- Model/provider/platform names, API brands, hosting vendors, backend vendors, infrastructure, internal library names, SDK names, framework names, service architecture, or engineering terms.
- Text such as "hosted AI", "AI model processed", "API request successful", "powered by [provider]", "backend complete", "using cloud processing", "endpoint returned 200", "pipeline finished", "database updated", "implemented with [framework]", or "feature working now".
- Development diary copy: "we implemented", "the agent generated", "demo mode", "testing this feature", "temporary placeholder", "coming soon" for a supposedly launched feature, "mock data" presented as real, or comments written for engineers.
- Console traces, raw exception text, internal error codes, stack traces, file paths, request IDs, or server responses shown directly to customers.
- Empty marketing fluff, unverified capabilities, invented reviews, false assurances, or automatically added badges such as "AI powered" unless expressly approved by the client.

**Exceptions:** Preserve necessary, truthful and appropriately placed notices: privacy/data processing disclosures, terms, accessibility information, payment/security information, required attributions, and legal/regulatory obligations. If users truly need to know that a third-party or AI service processes their uploads, disclose that accurately in the appropriate notice/consent area; do not misleadingly hide it. Do not assert compliance that has not been established. Technical details can remain in comments, tests, internal documentation, telemetry, structured logs, and developer tools, provided those are not exposed to end users.

## Core voice and presentation

- Write in concise, natural, helpful language matching the site's brand, intended audience, locale, and established tone. If no brand voice is supplied, use clean, neutral, confident product language.
- Favor outcomes and clear actions. Prefer "Download image" to "Execute background removal output retrieval".
- Keep headings descriptive, buttons verb-led, confirmations brief, and helper text only as detailed as needed.
- Use consistent terminology across pages (e.g., choose either "Remove background" or "Erase background" and use it consistently).
- Do not overhype with unnecessary exclamation points, emojis, technical buzzwords, or claims of "instant", "perfect", "100%", "secure", or "free" unless verified.
- Do not introduce unexplained acronyms. Preserve correct spelling, capitalization, punctuation, and accessible labels.
- Never substitute vague copy for meaningful feedback. Customers must understand real success, failure, and next steps.
- Don't mention competitors, suppliers, providers, or technology vendors in customer-facing messages unless the client requests this or an honest disclosure requires it.

## Required UX states for every interactive feature

Implement a coherent experience for:
1. **Default:** clear affordance and call to action.
2. **Validation:** specific, friendly input requirements before submission.
3. **Loading:** brief, accurate status text and disabled/guarded repeated submissions where appropriate.
4. **Success:** outcome + immediate next action; only report success after it is confirmed.
5. **Error:** human-readable, honest description and a practical recovery action. Log technical diagnostics separately without exposing them.
6. **Empty/canceled/retry:** intentional copy; preserve user input and avoid confusing dead ends where feasible.
7. **Accessibility:** usable semantic labels, focus management when relevant, keyboard support, contrast, and screen-reader status announcements.

All transitions must reflect actual state. Do not use a generic success toast if the operation failed, returned partial output, or has not finished.

## Specific example: background removal

| Situation | Customer-facing copy | Avoid |
|---|---|---|
| Button | Remove background | Run hosted AI inference |
| Loading | Removing background… | Sending request to our AI endpoint… |
| Success | Background removed | Background removed with hosted AI |
| Follow-up action | Download image | Retrieve processed asset from API |
| Invalid input | Choose a JPG, PNG, or WebP image. | Validation error: unsupported MIME type |
| Failure | We couldn't remove the background. Try again or use another image. | Model API error 502 / inference failed |
| No file selected | Choose an image to get started. | file=null |

Adapt formats and limits in these examples to what the actual application supports; do not promise support without checking code.

## Professional quality beyond copy

- Match the established brand system: typography, spacing, colors, iconography, content hierarchy, and responsive behavior.
- Make buttons, labels, toasts, dialogs, cards, menus, navigation, onboarding, forms, upload tools, progress states, and footer feel like one product.
- Do not add unsolicited product badges, vendor credits, floating promotional banners, made-up statistics, fabricated testimonials, placeholder contact details, or unnecessary marketing sections.
- Use real data when available; if content is not supplied, leave a clear internal TODO or use a visibly appropriate empty state rather than pretending made-up content is true.
- Keep the implementation and technology stack unchanged unless the task genuinely requires changes. Fix customer-facing copy at the right UI layer; do not remove real monitoring or operational error handling.
- Avoid visual and copy regressions across mobile, tablet, and desktop.

## Mandatory workflow on EVERY UI-related task

### Before writing code
1. Identify the feature's intended audience, brand voice, user goal, and currently established design/copy conventions from the project.
2. Review related screens/components to match existing terminology and patterns.
3. Decide what copy should be visible to customers versus retained in logs, source comments, or documentation.

### While implementing
4. Write concise, customer-oriented text for *every* UI state. Keep technical/provider implementation behind the interface.
5. Ensure messages reflect actual outcomes and errors and provide a sensible next action.
6. Preserve truthful disclosures and accessibility.

### Before declaring completion
7. Search all changed files and related flows for leaked technical/developer text, including visible HTML, JS/TSX/JSX/Vue/Svelte templates, strings, localization bundles, toasts, modals, tooltip titles, accessibility text, alt text, empty states, notification templates, and the page metadata that customers see.
8. Check neighboring screens and shared components so fixes don't leave inconsistent copy elsewhere.
9. Review happy path, loading, invalid input, failures, retries, and mobile layout. Run suitable project checks/tests if available.
10. Report *implementation details to the developer in chat/summary only*, never inject them into the site. Summarize what was polished and any copy requiring client approval.

## Required pre-launch whole-site audit

When asked for a site-wide review or launch-ready cleanup:
- Inventory routes/pages, UI components, and visible text sources. Include form errors, notifications, meta titles/descriptions, onboarding, settings, empty states, and downloads.
- Search for suspicious markers such as: `AI`, `LLM`, `model`, `API`, `endpoint`, `inference`, `hosted`, `provider`, `backend`, `database`, `pipeline`, `SDK`, `powered by`, `generated by`, `demo`, `test mode`, `mock`, `placeholder`, `TODO`, `lorem`, `localhost`, `stack trace`, and `status code`.
- **Do not blindly delete every match.** Determine whether each instance is visible, appropriate, necessary, and truthful. Retain internal-only code/docs and mandatory disclosures.
- Fix visible copy in-place without breaking functionality; do not change factual site content without approval.
- Check key user journeys manually or with available tests. If a UI can't be executed in the environment, clearly state the unverified flows in the developer-facing summary.
- Provide a concise before/after review for meaningful copy changes and list open approvals, if any.

## Final acceptance test

Before shipping, ask:
- Does any visible message sound like a programmer explaining the backend to a customer?
- Does any screen reveal AI/provider/hosting implementation for no user benefit?
- Would a customer instantly understand what happened and what to do next?
- Are errors honest, actionable, and free of raw debug details?
- Is copy consistent, grammatically polished, credible, accessible, and brand appropriate?
- Does every feature feel complete and client-ready, not like a prototype?

If any answer is no, correct it before marking the UI work done.
