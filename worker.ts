import vinextWorker from "vinext/server/fetch-handler";
import {
  closeDatabaseContext,
  runWithDatabaseContext,
  type DatabaseContext,
} from "./lib/db-context";
import type { DatabaseLike } from "./lib/sqlite";
import {
  sweepExpiredCutout,
  sweepOrphanProductMedia,
  type MediaBucket,
} from "./lib/media-storage";

type WorkerEnvironment = {
  DB: DatabaseLike;
  MEDIA?: MediaBucket;
  [key: string]: unknown;
};

type WorkerScheduledController = { scheduledTime?: number };

/** The worker runs hourly; the photo sweep is the one job that runs once a day. */
function isDailyPhotoSweep(scheduledTime: number | undefined): boolean {
  return typeof scheduledTime === "number" && new Date(scheduledTime).getUTCHours() === 3;
}

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

type WorkerHandler = {
  fetch(request: Request, env: WorkerEnvironment, ctx: WorkerExecutionContext): Promise<Response>;
};

const app = vinextWorker as WorkerHandler;

export default {
  async scheduled(controller: WorkerScheduledController, env: WorkerEnvironment) {
    globalThis.__kcpMediaBucket ??= env.MEDIA;
    const databaseContext: DatabaseContext = { db: env.DB };
    try {
      await runWithDatabaseContext(databaseContext, async () => {
        await sweepExpiredCutout();
        if (isDailyPhotoSweep(controller?.scheduledTime)) {
          const sweep = await sweepOrphanProductMedia();
          if (sweep.deleted.length || sweep.kept.length) {
            console.log("Product photo sweep", {
              scanned: sweep.scanned,
              referenced: sweep.referenced,
              deleted: sweep.deleted.length,
              kept: sweep.kept.length,
            });
          }
        }
      });
    } finally {
      await closeDatabaseContext(databaseContext);
    }
  },
  async fetch(request: Request, env: WorkerEnvironment, ctx: WorkerExecutionContext) {
    globalThis.__kcpWorkerDb ??= env.DB;
    globalThis.__kcpMediaBucket ??= env.MEDIA;
    const databaseContext: DatabaseContext = { db: env.DB };

    try {
      const response = await runWithDatabaseContext(databaseContext, () =>
        app.fetch(request, env, ctx)
      );
      const headers = new Headers(response.headers);
      const pathname = new URL(request.url).pathname;
      if (/^\/(?:invoice|quote)\//.test(pathname)) {
        headers.set("Cache-Control", "private, no-store");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("X-Robots-Tag", "noindex, nofollow");
      } else if (/^\/account\/verify\/?$/.test(pathname)) {
        headers.set("Cache-Control", "private, no-store");
        // The confirmation form must send a real Origin header; `no-referrer`
        // makes Chrome submit `Origin: null` and fail the same-origin check.
        headers.set("Referrer-Policy", "same-origin");
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
