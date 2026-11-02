import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await db.begin(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS order_business_notifications (reference text PRIMARY KEY REFERENCES orders(reference) ON DELETE CASCADE, provider_id text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now())`;
    await tx`CREATE TABLE IF NOT EXISTS support_conversations (id bigserial PRIMARY KEY, customer_token_hash text NOT NULL UNIQUE, name text NOT NULL, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days')`;
    await tx`CREATE TABLE IF NOT EXISTS support_reply_tokens (token_hash text PRIMARY KEY, conversation_id bigint NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now())`;
    await tx`ALTER TABLE support_reply_tokens ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'owner'`;
    await tx`CREATE TABLE IF NOT EXISTS support_messages (id bigserial PRIMARY KEY, conversation_id bigint NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE, sender text NOT NULL CHECK (sender IN ('customer','business')), body text NOT NULL, provider_event_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now())`;
    await tx`CREATE INDEX IF NOT EXISTS support_messages_conversation_idx ON support_messages (conversation_id, id)`;
  });
  console.log("Additive support and notification tables are ready.");
} finally { await db.end(); }
