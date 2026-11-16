import vinextWorker from "vinext/server/fetch-handler";
import { sql } from "./lib/db";
import {
  closeDatabaseContext,
  runWithDatabaseContext,
  type DatabaseContext,
} from "./lib/db-context";
import type { DatabaseLike } from "./lib/sqlite";

type WorkerEnvironment = {
  DB: DatabaseLike;
  [key: string]: unknown;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

type WorkerHandler = {
  fetch(request: Request, env: WorkerEnvironment, ctx: WorkerExecutionContext): Promise<Response>;
};

const app = vinextWorker as WorkerHandler;

export default {
  async scheduled(_controller: unknown, env: WorkerEnvironment) {
    const databaseContext: DatabaseContext = { db: env.DB };
    try {
      await runWithDatabaseContext(databaseContext, async () => {
        await sql`DELETE FROM cutout_bridge_images WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`;
      });
    } finally {
      await closeDatabaseContext(databaseContext);
    }
  },
  async fetch(request: Request, env: WorkerEnvironment, ctx: WorkerExecutionContext) {
    globalThis.__kcpWorkerDb ??= env.DB;
    const databaseContext: DatabaseContext = { db: env.DB };

    try {
      const response = await runWithDatabaseContext(databaseContext, () =>
        app.fetch(request, env, ctx)
      );
      const headers = new Headers(response.headers);
      const pathname = new URL(request.url).pathname;
      if (/^\/(?:invoice|quote)\//.test(pathname) || /^\/account\/verify\/?$/.test(pathname)) {
        headers.set("Cache-Control", "private, no-store");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("X-Robots-Tag", "noindex, nofollow");
      }

      if (!response.body) {
        await closeDatabaseContext(databaseContext);
        return new Response(null, { status: response.status, statusText: response.statusText, headers });
      }

      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            // Server components may continue rendering after app.fetch returns
            // its streaming response, so the database context is re-entered for
            // each read to keep deferred catalog queries working.
            const { done, value } = await runWithDatabaseContext(
              databaseContext,
              () => reader.read()
            );
            if (done) {
              controller.close();
              await closeDatabaseContext(databaseContext);
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
            await closeDatabaseContext(databaseContext);
          }
        },
        async cancel(reason) {
          await reader.cancel(reason);
          await closeDatabaseContext(databaseContext);
        },
      });

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      await closeDatabaseContext(databaseContext);
      throw error;
    }
  },
};
