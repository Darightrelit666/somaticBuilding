import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const cacheDir = path.resolve(projectRoot, ".cache");
const treeCachePath = path.resolve(cacheDir, "wrkout-exercise-tree.json");

const dbConfig = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3308"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "123456",
  database: process.env.MYSQL_DATABASE ?? "somaticbuilding_db"
};

const repoRef = process.env.WRKOUT_REF ?? "master";
const repoTreeUrl = `https://api.github.com/repos/wrkout/exercises.json/git/trees/${repoRef}?recursive=1`;
const repoRawBase = `https://raw.githubusercontent.com/wrkout/exercises.json/${repoRef}/`;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refreshCache = args.includes("--refresh-cache");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const minScoreArg = args.find((arg) => arg.startsWith("--min-score="));
const limit = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;
const minScore = minScoreArg ? Math.max(0, Number(minScoreArg.split("=")[1]) || 0.58) : 0.58;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "alternate",
  "alternating",
  "assisted",
  "at",
  "band",
  "bands",
  "barbell",
  "behind",
  "body",
  "bodyweight",
  "cable",
  "close",
  "cross",
  "decline",
  "double",
  "dumbbell",
  "exercise",
  "for",
  "front",
  "from",
  "grip",
  "in",
  "incline",
  "interval",
  "kettlebell",
  "kettlebells",
  "lying",
  "machine",
  "medium",
  "neutral",
  "of",
  "on",
  "one",
  "open",
  "plyo",
  "plyometric",
  "pulley",
  "reverse",
  "seated",
  "smith",
  "standing",
  "the",
  "to",
  "two",
  "using",
  "weight",
  "weighted",
  "wide",
  "with",
  "workout"
]);

const normalizeKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const canonicalKey = (value) =>
  normalizeKey(value)
    .split(/\s+/g)
    .map((token) => token.replace(/^[0-9]+$/, ""))
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token))
    .join(" ");

const tokenSet = (value) => new Set(canonicalKey(value).split(/\s+/g).filter(Boolean));

const nameSimilarityScore = (left, right) => {
  const a = normalizeKey(left);
  const b = normalizeKey(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.94;

  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  const union = aTokens.size + bTokens.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = intersection / Math.min(aTokens.size, bTokens.size);
  return Number((jaccard * 0.65 + containment * 0.35).toFixed(4));
};

const canonicalSimilarityScore = (left, right) => {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (a.size === 0 || b.size === 0) return 0;
  if (canonicalKey(left) === canonicalKey(right)) return 1;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = intersection / Math.min(a.size, b.size);
  return Number((jaccard * 0.6 + containment * 0.4).toFixed(4));
};

const scoreName = (left, right) =>
  Math.max(nameSimilarityScore(left, right), canonicalSimilarityScore(left, right));

const candidateFolderNames = (exerciseName) => {
  const base = String(exerciseName ?? "").trim();
  const splitParts = base
    .split(/\s*[–—]\s*|\s+-\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const variants = new Set([
    base,
    base.replace(/[–—]/g, "-"),
    base.replace(/\//g, "_"),
    base.replace(/\//g, " "),
    base.replace(/&/g, "and")
  ]);

  const folders = new Set();
  for (const variant of variants) {
    const compact = variant
      .replace(/[^a-z0-9-]+/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (compact) folders.add(compact);

    const strict = variant
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (strict) folders.add(strict);
  }

  if (splitParts.length >= 2) {
    const normalizedParts = splitParts.map((part) =>
      part
        .replace(/[^a-z0-9-]+/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
    );
    const forward = normalizedParts.join("_");
    const reverse = [...normalizedParts].reverse().join("_");
    if (forward) folders.add(forward);
    if (reverse) folders.add(reverse);
  }

  return [...folders];
};

const escapeSql = (value) => String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");

const toSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${escapeSql(value)}'`;
};

const runMysql = (sql) =>
  new Promise((resolve, reject) => {
    const mysqlArgs = [
      "-h",
      dbConfig.host,
      "-P",
      String(dbConfig.port),
      "-u",
      dbConfig.user,
      `-p${dbConfig.password}`,
      "-D",
      dbConfig.database,
      "--default-character-set=utf8mb4",
      "-N",
      "-B"
    ];

    const child = spawn("mysql", mysqlArgs, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`mysql exited with code ${code}: ${stderr || stdout}`));
      }
    });

    child.stdin.write(sql);
    child.stdin.end();
  });

const fetchJsonWithRetry = async (url, attempts = 4, timeoutMs = 20000) => {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "somaticbuilding-cover-backfill"
        },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        const status = Number(error?.status ?? 0);
        const baseDelay =
          status === 429 || status === 503
            ? 2000 * i
            : error?.name === "AbortError"
            ? 1600 * i
            : 800 * i;
        await new Promise((resolve) => setTimeout(resolve, baseDelay));
      }
    }
  }
  throw lastError;
};

const loadWrkoutFolders = async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  if (!refreshCache) {
    try {
      const cached = JSON.parse(await fs.readFile(treeCachePath, "utf-8"));
      if (
        cached &&
        Array.isArray(cached.folders) &&
        cached.folders.length > 0 &&
        cached.repoRef === repoRef
      ) {
        return cached.folders;
      }
    } catch {
      // fall through to fetch
    }
  }

  const payload = await fetchJsonWithRetry(repoTreeUrl, 5, 30000);
  const paths = Array.isArray(payload?.tree) ? payload.tree.map((item) => item?.path) : [];
  const folders = [...new Set(
    paths
      .filter((value) => typeof value === "string" && /\/images\/0\.jpg$/i.test(value))
      .map((value) => value.replace(/\/images\/0\.jpg$/i, ""))
      .filter((value) => value.startsWith("exercises/"))
  )].sort((left, right) => left.localeCompare(right));

  await fs.writeFile(
    treeCachePath,
    JSON.stringify(
      {
        repoRef,
        fetchedAt: new Date().toISOString(),
        folders
      },
      null,
      2
    ),
    "utf-8"
  );

  return folders;
};

const findBestFolder = (row, folders) => {
  const exactCandidates = candidateFolderNames(row.name).map((folder) => `exercises/${folder}`);
  const folderSet = new Set(folders);
  for (const candidate of exactCandidates) {
    if (folderSet.has(candidate)) {
      return { folder: candidate, score: 1, strategy: "exact" };
    }
  }

  const equipmentKey = canonicalKey(row.equipment);
  const muscleKey = canonicalKey(row.primaryMuscle);
  let best = null;
  for (const folder of folders) {
    const folderName = folder.split("/").pop() ?? "";
    const folderKey = canonicalKey(folderName);
    let score = scoreName(row.name, folderName);
    if (equipmentKey && folderKey.includes(equipmentKey)) {
      score += 0.05;
    }
    if (muscleKey && folderKey.includes(muscleKey)) {
      score += 0.02;
    }
    score = Number(Math.min(score, 1).toFixed(4));
    if (!best || score > best.score) {
      best = { folder, score, strategy: "fuzzy" };
    }
  }

  return best && best.score >= minScore ? best : null;
};

const readPlaceholderRows = async () => {
  const sql = `
SELECT
  m.id AS media_id,
  e.id AS exercise_id,
  e.name,
  e.equipment,
  e.primary_muscle,
  m.url
FROM exercise_media m
JOIN exercise e
  ON e.id = m.exercise_id
WHERE m.is_deleted = 0
  AND e.is_deleted = 0
  AND m.media_type = 'image'
  AND m.cover_flag = 1
  AND (
    m.url IS NULL
    OR m.url = ''
    OR m.url LIKE '/images/exercises/placeholders/%'
  )
ORDER BY e.id ASC;`;

  const result = await runMysql(sql);
  const rows = result.stdout
    .trim()
    .split(/\r?\n/g)
    .filter(Boolean)
    .map((line) => {
      const [mediaId, exerciseId, name, equipment, primaryMuscle, url] = line.split("\t");
      return {
        mediaId: Number(mediaId),
        exerciseId: Number(exerciseId),
        name,
        equipment: equipment ?? "",
        primaryMuscle: primaryMuscle ?? "",
        url: url ?? ""
      };
    })
    .filter((row) => Number.isFinite(row.mediaId) && Number.isFinite(row.exerciseId) && row.name);

  return rows;
};

const updateMediaUrl = async (mediaId, url) => {
  const sql = `
UPDATE exercise_media
SET url = ${toSqlValue(url)},
    media_type = 'image',
    cover_flag = 1,
    update_time = NOW(3)
WHERE id = ${toSqlValue(mediaId)};`;
  await runMysql(sql);
};

const folders = await loadWrkoutFolders();
const placeholderRows = await readPlaceholderRows();

let updated = 0;
let matched = 0;
let missed = 0;
const sampleMisses = [];
const sampleMatches = [];

for (const row of placeholderRows) {
  if (limit > 0 && updated >= limit) break;

  const best = findBestFolder(row, folders);
  if (!best) {
    missed += 1;
    if (sampleMisses.length < 20) {
      sampleMisses.push(row.name);
    }
    continue;
  }

  const coverUrl = `${repoRawBase}${best.folder}/images/0.jpg`;
  matched += 1;
  if (sampleMatches.length < 20) {
    sampleMatches.push({
      name: row.name,
      folder: best.folder,
      score: best.score,
      url: coverUrl
    });
  }

  if (!dryRun) {
    await updateMediaUrl(row.mediaId, coverUrl);
  }
  updated += 1;
}

const summary = {
  mode: dryRun ? "dry-run" : "apply",
  repoRef,
  folders: folders.length,
  placeholderRows: placeholderRows.length,
  matched,
  missed,
  updated,
  minScore,
  limit: limit || null,
  sampleMatches,
  sampleMisses
};

console.log(JSON.stringify(summary, null, 2));
