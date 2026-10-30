import { AsyncLocalStorage } from "node:async_hooks";
import type postgres from "postgres";

export type DatabaseContext = {
  connectionString: string;
  client?: ReturnType<typeof postgres>;
};

const databaseContext = new AsyncLocalStorage<DatabaseContext>();

export function getDatabaseContext() {
  return databaseContext.getStore();
}

export function runWithDatabaseContext<T>(
  context: DatabaseContext,
  callback: () => T
) {
  return databaseContext.run(context, callback);
}

export async function closeDatabaseContext(context: DatabaseContext) {
  if (context.client) {
    const client = context.client;
    context.client = undefined;
    try {
      await client.end({ timeout: 1 });
    } catch (error) {
      console.warn("Could not close the request database client cleanly:", error);
    }
  }
}
