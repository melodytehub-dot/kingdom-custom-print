import { DatabaseSync } from "node:sqlite";
import { readFileSync, rmSync } from "node:fs";

const file = ".local-db/schema-check.sqlite";
rmSync(file, { force: true });
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync("db/schema.sqlite.sql", "utf8"));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("tables", tables.length, tables.map(t => t.name).join(","));

db.prepare("INSERT INTO categories (slug, name, description, sort_order) VALUES (?,?,?,?)").run("t-shirts", "T-Shirts", "", 1);
db.prepare(`INSERT INTO products (slug, name, style_code, category_id, kind, base_price, featured, active)
            VALUES (?,?,?,?,?,?,?,?)`).run("probe-tee", "Probe Tee", "RT2000", 1, "tee", 19.99, 1, 1);
db.prepare("INSERT INTO product_colors (product_id, slug, name, hex, sort_order) VALUES (?,?,?,?,?)").run(1, "black", "Black", "#111111", 0);
db.prepare("INSERT INTO product_sizes (product_id, label, surcharge) VALUES (?,?,?)").run(1, "M", 0);
console.log("product", db.prepare("SELECT id, slug, base_price, print_area, featured FROM products").get());

db.prepare("INSERT INTO site_settings (key, value) VALUES (?,?)").run("hero_label", JSON.stringify("PRINT ON DEMAND"));
console.log("setting", db.prepare("SELECT key, value FROM site_settings").get());

db.prepare("UPDATE products SET name = ? WHERE id = ?").run("Probe Tee Two", 1);
console.log("updated_at moved", Boolean(db.prepare("SELECT updated_at, created_at FROM products").get()));

db.prepare("INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)").run("abc", new Date(Date.now() + 3600_000).toISOString());
console.log("session live", db.prepare("SELECT count(*) AS n FROM admin_sessions WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')").get());
console.log("schema OK");
