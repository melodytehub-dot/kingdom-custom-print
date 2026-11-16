/**
 * Minimal Resend stand-in for local browser QA.
 *
 * POST /emails captures the message to KCP_MOCK_MAIL_FILE so a test can read
 * the confirmation link. Start it before the dev server and point
 * RESEND_API_URL at http://127.0.0.1:3099.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const port = Number(process.env.KCP_MOCK_MAIL_PORT ?? 3099);
const file = process.env.KCP_MOCK_MAIL_FILE ?? ".local-db/qa-mail.json";
mkdirSync(dirname(file), { recursive: true });

let counter = 0;
const server = createServer((request, response) => {
  if (request.method === "POST" && request.url === "/emails") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const message = JSON.parse(body);
        writeFileSync(file, JSON.stringify(message, null, 2));
      } catch {
        writeFileSync(file, JSON.stringify({ raw: body }, null, 2));
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: `qa-mail-${++counter}` }));
    });
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock mail listening on http://127.0.0.1:${port} -> ${file}`);
});
