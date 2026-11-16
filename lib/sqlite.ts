/**
 * A small postgres.js-style query API over SQLite (Cloudflare D1 locally and
 * in production).
 *
 * The storefront composes SQL with tagged templates (`sql`...``) and fragments.
 * This module keeps that shape while emitting SQLite placeholders so query code
 * reads the same everywhere.
 *
 * SQLite has no interactive transactions, so `begin()` is not implemented.
 * Multi-statement atomicity is available through `batch()`, which D1 runs as a
 * single transaction and the local driver emulates with BEGIN IMMEDIATE.
 */

export type SqlValue = unknown;

export interface SqlFragment {
  readonly __fragment: true;
  readonly text: string;
  readonly params: SqlValue[];
}

export type SqlResult<T = Record<string, unknown>> = {
  results: T[];
  success?: boolean;
  meta?: { changes?: number };
};

export interface PreparedStatementLike {
  bind(...values: SqlValue[]): PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>> | SqlResult<T>;
  run(): Promise<unknown> | unknown;
  first<T = Record<string, unknown>>(): Promise<T | null> | T | null;
}

/** The subset of Cloudflare's D1 binding the app relies on. */
export interface DatabaseLike {
  prepare(sql: string): PreparedStatementLike;
  batch?(statements: PreparedStatementLike[]): Promise<SqlResult<unknown>[]>;
}

export class SqliteUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqliteUnsupportedError";
  }
}

/** Rows returned by a query, carrying the affected-row count like postgres.js. */
export type Rows<T> = T[] & { count: number };

function isFragment(value: unknown): value is SqlFragment {
  return Boolean(value && typeof value === "object" && (value as SqlFragment).__fragment === true);
}

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

/** Converts a JavaScript value into something SQLite can bind. */
export function bindValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (isBinary(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function build(strings: TemplateStringsArray, values: SqlValue[]): { text: string; params: SqlValue[] } {
  let text = strings[0];
  const params: SqlValue[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (isFragment(value)) {
      text += value.text;
      params.push(...value.params);
    } else {
      text += "?";
      params.push(bindValue(value));
    }
    text += strings[index + 1];
  }
  return { text, params };
}

function withCount<T>(rows: T[], count: number): Rows<T> {
  Object.defineProperty(rows, "count", { value: count, enumerable: false, configurable: true });
  return rows as Rows<T>;
}

class SqlQuery<T> implements PromiseLike<Rows<T>>, SqlFragment {
  readonly __fragment = true as const;
  constructor(
    private readonly db: DatabaseLike,
    readonly text: string,
    readonly params: SqlValue[]
  ) {}

  /** The prepared statement this query represents, for use inside a batch. */
  statement(): PreparedStatementLike {
    const prepared = this.db.prepare(this.text);
    return this.params.length ? prepared.bind(...this.params) : prepared;
  }

  then<TResult1 = Rows<T>, TResult2 = never>(
    onfulfilled?: ((value: Rows<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<Rows<T> | TResult> {
    return this.execute().catch(onrejected);
  }

  private async execute(): Promise<Rows<T>> {
    const result = await this.statement().all<T>();
    const rows = result?.results ?? [];
    return withCount(rows, result?.meta?.changes ?? rows.length);
  }
}

export type SqlClient = {
  <T = Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...values: SqlValue[]
  ): SqlQuery<T extends unknown[] ? T[number] : T>;
  json(value: unknown): SqlFragment;
  array(values: readonly unknown[]): SqlFragment;
  /** Runs every statement in one transaction and returns each result in order. */
  batch(queries: readonly SqlFragment[]): Promise<Rows<Record<string, unknown>>[]>;
  begin<T>(work: (tx: SqlClient) => Promise<T>): Promise<T>;
  readonly text: (value: string) => SqlFragment;
};

/**
 * Creates the tagged-template client. `begin` throws on purpose: D1 has no
 * interactive transactions, and silently dropping atomicity would put money
 * paths at risk. Multi-statement writes use `batch`.
 */
export function createSqlClient(db: DatabaseLike): SqlClient {
  const client = (<T,>(strings: TemplateStringsArray, ...values: SqlValue[]) => {
    const fragment = build(strings, values);
    return new SqlQuery<T extends unknown[] ? T[number] : T>(db, fragment.text, fragment.params);
  }) as SqlClient;

  (client as { json: (value: unknown) => SqlFragment }).json = (value: unknown) => ({
    __fragment: true,
    text: "?",
    params: [JSON.stringify(value)],
  });

  (client as { array: (values: readonly unknown[]) => SqlFragment }).array = (values: readonly unknown[]) => ({
    __fragment: true,
    text: values.length ? values.map(() => "?").join(", ") : "NULL",
    params: values.map(bindValue),
  });

  (client as { text: (value: string) => SqlFragment }).text = (value: string) => ({
    __fragment: true,
    text: value,
    params: [],
  });

  (client as { begin: <T>(work: (tx: SqlClient) => Promise<T>) => Promise<T> }).begin = async () => {
    throw new SqliteUnsupportedError(
      "Interactive transactions are not supported by this database. Use sql.batch() instead."
    );
  };

  (client as { batch: (queries: readonly SqlFragment[]) => Promise<Rows<Record<string, unknown>>[]> }).batch = async (
    queries: readonly SqlFragment[]
  ) => {
    const statements = queries.map((query) => {
      const prepared = db.prepare(query.text);
      return query.params.length ? prepared.bind(...query.params) : prepared;
    });
    if (!db.batch) {
      throw new SqliteUnsupportedError("This database does not support batches.");
    }
    const results = await db.batch(statements);
    return results.map((result) => {
      const rows = (result?.results ?? []) as Record<string, unknown>[];
      return withCount(rows, result?.meta?.changes ?? rows.length);
    });
  };

  return client;
}
