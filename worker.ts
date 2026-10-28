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
    const databaseContext: DatabaseContext = {
      connectionString: env.HYPERDRIVE.connectionString,
    };

    try {
      const response = await runWithDatabaseContext(databaseContext, () =>
        app.fetch(request, env, ctx)
      );

      if (!response.body) {
        await closeDatabaseContext(databaseContext);
        return response;
      }

      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
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
        headers: response.headers,
      });
    } catch (error) {
      await closeDatabaseContext(databaseContext);
      throw error;
    }
  },
};
