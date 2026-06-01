import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const mediaStorageRoot = path.resolve(
  projectRoot,
  "backend",
  "exercise-service",
  "storage",
  "exercise-media"
);

const dbConfig = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3308"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "123456",
  database: process.env.MYSQL_DATABASE ?? "somaticbuilding_db"
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepTemp = args.includes("--keep-temp");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;

const LOCAL_MEDIA_PREFIX = "/api/v1/exercise/media/file/";

const normalizeKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

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

const runFfmpeg = (inputPathOrUrl, outputPath) =>
  new Promise((resolve, reject) => {
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      "00:00:00.6",
      "-i",
      inputPathOrUrl,
      "-frames:v",
      "1",
      "-vf",
      "scale='if(gt(iw,960),960,iw)':-2",
      "-q:v",
      "3",
      outputPath
    ];

    const child = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"]
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
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });

const readPlaceholderRows = async () => {
  const sql = `
SELECT
  e.id AS exercise_id,
  e.name,
  m.id AS cover_media_id,
  m.url AS cover_url,
  COALESCE(
    (
      SELECT vm.url
      FROM exercise_media vm
      WHERE vm.exercise_id = e.id
        AND vm.media_type = 'video'
        AND vm.is_deleted = 0
      ORDER BY vm.id DESC
      LIMIT 1
    ),
    ''
  ) AS video_url
FROM exercise e
JOIN exercise_media m
  ON m.exercise_id = e.id
 AND m.media_type = 'image'
 AND m.cover_flag = 1
 AND m.is_deleted = 0
WHERE e.is_deleted = 0
  AND m.url LIKE '/images/exercises/placeholders/%'
ORDER BY e.id ASC;`;

  const result = await runMysql(sql);
  const rows = result.stdout
    .trim()
    .split(/\r?\n/g)
    .filter(Boolean)
    .map((line) => {
      const [exerciseId, name, coverMediaId, coverUrl, videoUrl] = line.split("\t");
      return {
        exerciseId: Number(exerciseId),
        name: name ?? "",
        coverMediaId: Number(coverMediaId),
        coverUrl: coverUrl ?? "",
        videoUrl: videoUrl ?? ""
      };
    })
    .filter(
      (row) =>
        Number.isFinite(row.exerciseId) &&
        row.exerciseId > 0 &&
        Number.isFinite(row.coverMediaId) &&
        row.coverMediaId > 0
    );

  return rows;
};

const resolveVideoInput = async (videoUrl) => {
  const normalized = String(videoUrl ?? "").trim();
  if (!normalized) return null;

  if (normalized.startsWith(LOCAL_MEDIA_PREFIX)) {
    const fileName = normalized.slice(LOCAL_MEDIA_PREFIX.length);
    if (!fileName) return null;
    const resolved = path.resolve(mediaStorageRoot, fileName);
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) return null;
      return resolved;
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return null;
};

const updateCoverUrl = async (coverMediaId, url) => {
  const sql = `
UPDATE exercise_media
SET url = ${toSqlValue(url)},
    media_type = 'image',
    cover_flag = 1,
    update_time = NOW(3)
WHERE id = ${toSqlValue(coverMediaId)};`;
  await runMysql(sql);
};

await fs.mkdir(mediaStorageRoot, { recursive: true });

const rows = await readPlaceholderRows();
let processed = 0;
let updated = 0;
let skipped = 0;
let failed = 0;
const failedItems = [];
const updatedItems = [];

for (const row of rows) {
  if (limit > 0 && processed >= limit) break;
  processed += 1;

  const input = await resolveVideoInput(row.videoUrl);
  if (!input) {
    skipped += 1;
    failedItems.push({
      id: row.exerciseId,
      name: row.name,
      reason: "No readable video source"
    });
    continue;
  }

  const slug = normalizeKey(row.name).slice(0, 72) || `exercise-${row.exerciseId}`;
  const fileName = `cover-auto-${row.exerciseId}-${slug}-${Date.now()}.jpg`;
  const outputPath = path.resolve(mediaStorageRoot, fileName);
  const outputUrl = `${LOCAL_MEDIA_PREFIX}${fileName}`;

  try {
    await runFfmpeg(input, outputPath);
    if (!dryRun) {
      await updateCoverUrl(row.coverMediaId, outputUrl);
    }
    updated += 1;
    if (updatedItems.length < 25) {
      updatedItems.push({
        id: row.exerciseId,
        name: row.name,
        coverUrl: outputUrl,
        source: row.videoUrl
      });
    }
    if (dryRun && !keepTemp) {
      try {
        await fs.unlink(outputPath);
      } catch {
        // ignore
      }
    }
  } catch (error) {
    failed += 1;
    failedItems.push({
      id: row.exerciseId,
      name: row.name,
      reason: String(error?.message ?? error),
      source: row.videoUrl
    });
    try {
      await fs.unlink(outputPath);
    } catch {
      // ignore
    }
  }
}

const summary = {
  mode: dryRun ? "dry-run" : "apply",
  placeholderRows: rows.length,
  processed,
  updated,
  skipped,
  failed,
  limit: limit || null,
  samples: updatedItems,
  failedItems: failedItems.slice(0, 25)
};

console.log(JSON.stringify(summary, null, 2));
