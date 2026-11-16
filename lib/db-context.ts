import type { DatabaseLike } from "./sqlite";

export type DatabaseContext = {
  db: DatabaseLike;
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

/** Kept for callers that close request-scoped resources. */
export async function closeDatabaseContext(_context: DatabaseContext) {
  // SQLite and D1 connections are managed by the platform; nothing to close.
}
