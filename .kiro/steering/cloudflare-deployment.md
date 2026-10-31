---
inclusion: always
---

# Deployment and troubleshooting

This project deploys to **Cloudflare Workers Builds**, not Cloudflare Pages or Vercel. GitHub `main` pushes automatically build and deploy the production Worker `kingdom-custom-print` at https://kingdomcustomprint.com. The Worker script tag is `1be2fa27cd58458f8d67d690dbdf33c5`. A script tag is an immutable ID, not the Worker name.

Use the terminal in this workspace to investigate without asking the user to visit a dashboard:

```powershell
gh auth status
npx wrangler whoami
npx cf builds workers get 1be2fa27cd58458f8d67d690dbdf33c5
npx cf builds list --external-script-id 1be2fa27cd58458f8d67d690dbdf33c5 --per-page 5
npx cf builds logs get <build_uuid>
gh api repos/melodytehub-dot/kingdom-custom-print/commits/<commit-sha>/check-runs --jq '.check_runs[] | {name,status,conclusion,details_url}'
```

Match the build's `build_trigger_metadata.commit_hash` to the commit being checked. A build can have `status: stopped` with either `build_outcome: success` or `fail`. Read its logs for the actual error; use the returned cursor if logs are paginated. The GitHub check's details URL contains the build UUID too. If authentication or permissions fail, report the exact error and request login only when needed. Never print, commit, or request secrets in chat.

Production build command: `npm run build`. Production deploy command: `npx cf deploy --prebuilt`. The build uses Vite/Vinext and `cloudflare.config.ts`; `next build` and `wrangler deploy` are not the production workflow. Do not alter routes, bindings, secrets, production data, or deploy settings to troubleshoot without understanding their effects. `npx cf deploy --prebuilt` publishes to production; never use it for a preview or an unrequested release. Prefer GitHub auto-deployment when authorized to push.

Before pushing, inspect the working tree and remote; preserve other agents' work. After an authorized push to `main`, follow the matching GitHub check or Cloudflare build to completion, inspect failure logs, and verify the live site if deployment succeeds. A local build or HTTP 200 alone does not prove a particular commit is deployed.
