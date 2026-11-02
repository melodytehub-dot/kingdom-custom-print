import vinextWorker from "vinext/server/fetch-handler";
import {
  closeDatabaseContext,
  runWithDatabaseContext,
  type DatabaseContext,
} from "./lib/db-context";

type WorkerEnvironment = {
  HYPERDRIVE: { connectionString: string };
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
  async fetch(request: Request, env: WorkerEnvironment, ctx: WorkerExecutionContext) {
    globalThis.__kcpWorkerConnectionString ??= env.HYPERDRIVE.connectionString;
    const databaseContext: DatabaseContext = {
      connectionString: env.HYPERDRIVE.connectionString,
    };

    try {
      const response = await runWithDatabaseContext(databaseContext, () =>
        app.fetch(request, env, ctx)
      );
      const headers = new Headers(response.headers);
      if (new URL(request.url).pathname.startsWith("/invoice/")) {
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
            // its streaming response. Re-enter the request database context for
            // each read so deferred catalog queries still have Hyperdrive.
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
