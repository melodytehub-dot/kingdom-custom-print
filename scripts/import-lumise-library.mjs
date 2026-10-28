import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const archivePath = args.get("--archive");
const sqlPath = args.get("--sql");
const outputRoot = resolve(args.get("--output") ?? "public/lumise");

if (!archivePath || !sqlPath) {
  console.error("Usage: node scripts/import-lumise-library.mjs --archive <lumise_data.zip> --sql <database.sql> [--output public/lumise]");
  process.exit(1);
}

const sourceArchive = resolve(archivePath);
const sourceSql = resolve(sqlPath);
if (!existsSync(sourceArchive) || !existsSync(sourceSql)) {
  console.error("The Lumise archive or SQL export could not be found.");
  process.exit(1);
}

const tempRoot = mkdtempSync(join(tmpdir(), "kingdom-lumise-"));

function decodeSqlString(value) {
  return value
    .replace(/\\0/g, "\0")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\Z/g, "\x1a")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "NULL") return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    return decodeSqlString(value.slice(1, -1).replace(/''/g, "'"));
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}

function parseTuples(input) {
  const rows = [];
  let row = null;
  let token = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      token += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "'" && input[index + 1] === "'") {
        token += input[index + 1];
        index += 1;
      } else if (char === "'") {
        inString = false;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      token += char;
    } else if (char === "(" && row === null) {
      row = [];
      token = "";
    } else if (char === "," && row !== null) {
      row.push(parseScalar(token));
      token = "";
    } else if (char === ")" && row !== null) {
      row.push(parseScalar(token));
      rows.push(row);
      row = null;
      token = "";
    } else if (row !== null) {
      token += char;
    }
  }
  return rows;
}

function readTable(sql, table) {
  const rows = [];
  const expression = new RegExp(
    "INSERT INTO `" + table + "` \\(([^)]+)\\) VALUES\\s*([\\s\\S]*?);(?:\\r?\\n|$)",
    "g",
  );
  for (const match of sql.matchAll(expression)) {
    const columns = match[1].split(",").map((column) => column.trim().replaceAll("`", ""));
    for (const values of parseTuples(match[2])) {
      rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
    }
  }
  return rows;
}

function safeRelativePath(path) {
  const normalized = String(path ?? "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) return null;
  return normalized;
}

function publicPath(path) {
  return `/${relative(resolve("public"), path).split(sep).join("/")}`;
}

function copyAsset(sourceRoot, uploadPath) {
  const relativePath = safeRelativePath(uploadPath);
  if (!relativePath) return null;
  const source = resolve(sourceRoot, relativePath);
  if (!source.startsWith(`${resolve(sourceRoot)}${sep}`) || !existsSync(source)) return null;
  const destination = resolve(outputRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return { source, destination };
}

function svgAspect(path) {
  const source = readFileSync(path, "utf8").slice(0, 4096);
  const viewBox = source.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBox) return Number(viewBox[1]) / Number(viewBox[2]);
  const width = source.match(/\bwidth=["']([\d.]+)/i);
  const height = source.match(/\bheight=["']([\d.]+)/i);
  return width && height ? Number(width[1]) / Number(height[1]) : 1;
}

function pngAspect(path) {
  const source = readFileSync(path);
  if (source.length >= 24 && source.toString("ascii", 1, 4) === "PNG") {
    return source.readUInt32BE(16) / source.readUInt32BE(20);
  }
  return 1;
}

function screenshotPath(row) {
  const screenshot = String(row.screenshot ?? "");
  const marker = "/lumise_data/";
  const markerIndex = screenshot.indexOf(marker);
  if (markerIndex >= 0) return screenshot.slice(markerIndex + marker.length);
  return String(row.upload ?? "").replace(/\.lumi$/i, "-thumbn.png");
}

function words(value) {
  return String(value ?? "")
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

try {
  execFileSync("tar", ["-xf", sourceArchive, "-C", tempRoot, "cliparts", "templates"], { stdio: "inherit" });
  const sql = readFileSync(sourceSql, "utf8");
  const categories = readTable(sql, "lumise_categories");
  const references = readTable(sql, "lumise_categories_reference");
  const categoryById = new Map(categories.map((category) => [Number(category.id), category]));
  const categoriesByItem = new Map();

  for (const reference of references) {
    const key = `${reference.type}:${reference.item_id}`;
    const ids = categoriesByItem.get(key) ?? [];
    ids.push(Number(reference.category_id));
    categoriesByItem.set(key, ids);
  }

  const rootCategory = (type, itemId) => {
    const ids = categoriesByItem.get(`${type}:${itemId}`) ?? [];
    let category = ids.map((id) => categoryById.get(id)).find(Boolean);
    if (!category) return type === "templates" ? "Templates" : "Other";
    const visited = new Set();
    while (Number(category.parent) > 0 && !visited.has(Number(category.id))) {
      visited.add(Number(category.id));
      category = categoryById.get(Number(category.parent)) ?? category;
    }
    return String(category.name || "Other").trim();
  };

  const missing = [];
  const cliparts = readTable(sql, "lumise_cliparts")
    .filter((row) => Number(row.active) === 1)
    .map((row) => {
      const copied = copyAsset(tempRoot, row.upload);
      if (!copied) {
        missing.push(String(row.upload));
        return null;
      }
      return {
        id: `lumise-${row.id}`,
        name: String(row.name || `Artwork ${row.id}`).trim(),
        src: publicPath(copied.destination),
        category: rootCategory("cliparts", row.id),
        tags: words(row.tags),
        aspect: Number(svgAspect(copied.source).toFixed(4)),
      };
    })
    .filter(Boolean);

  const templates = readTable(sql, "lumise_templates")
    .filter((row) => Number(row.active) === 1)
    .map((row) => {
      const upload = screenshotPath(row);
      const copied = copyAsset(tempRoot, upload);
      if (!copied) {
        missing.push(upload);
        return null;
      }
      return {
        id: `lumise-template-${row.id}`,
        name: String(row.name || `Template ${row.id}`).trim(),
        category: rootCategory("templates", row.id),
        subtitle: "Ready-made design",
        tags: words(row.tags),
        previewSrc: publicPath(copied.destination),
        aspect: Number(pngAspect(copied.source).toFixed(4)),
      };
    })
    .filter(Boolean);

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(
    join(outputRoot, "cliparts.json"),
    `${JSON.stringify({
      categories: [...new Set(cliparts.map((item) => item.category))].sort(),
      items: cliparts,
    })}\n`,
  );
  writeFileSync(
    join(outputRoot, "templates.json"),
    `${JSON.stringify({
      categories: [...new Set(templates.map((item) => item.category))].sort(),
      items: templates,
    })}\n`,
  );

  console.log(`Imported ${cliparts.length} cliparts and ${templates.length} templates into ${outputRoot}.`);
  if (missing.length) console.warn(`Skipped ${missing.length} missing files. First missing entries: ${missing.slice(0, 10).join(", ")}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
