import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const storageRoot = path.resolve(
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

const ffmpegCommand = process.env.FFMPEG_COMMAND ?? "ffmpeg";
const durationSec = Number(process.env.AUTO_VIDEO_DURATION_SEC ?? "8");
const defaultDuration = Number.isFinite(durationSec) && durationSec > 2 ? Math.min(durationSec, 20) : 8;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allowRemoteFetch = args.includes("--allow-remote-fetch");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sb-video-backfill-"));

const escapeSql = (value) =>
  String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");

const toSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${escapeSql(value)}'`;
};

const runProcess = (command, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      ...options
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
      resolve({
        code: code ?? 1,
        stdout,
        stderr
      });
    });
  });

const runMysqlWithInput = (sql) =>
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

const readMissingExercises = async () => {
  const limitSql = limit > 0 ? `\nLIMIT ${limit}` : "";
  const sql = `
SELECT
  e.id,
  e.name,
  COALESCE(
    (
      SELECT m.url
      FROM exercise_media m
      WHERE m.exercise_id = e.id
        AND m.is_deleted = 0
        AND m.media_type = 'image'
      ORDER BY m.cover_flag DESC, m.id DESC
      LIMIT 1
    ),
    ''
  ) AS image_url
FROM exercise e
WHERE e.is_deleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_media vm
    WHERE vm.exercise_id = e.id
      AND vm.is_deleted = 0
      AND vm.media_type = 'video'
  )
ORDER BY e.id${limitSql};
`;

  const result = await runMysqlWithInput(sql);
  const lines = result.stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [idRaw, nameRaw, imageUrlRaw] = line.split("\t");
    return {
      id: Number(idRaw),
      name: nameRaw ?? "",
      imageUrl: imageUrlRaw ?? ""
    };
  }).filter((row) => Number.isFinite(row.id) && row.id > 0 && row.name.trim().length > 0);
};

const isSvgPath = (value) => value.toLowerCase().endsWith(".svg");

const ensureLocalImage = async (url, id) => {
  const safeUrl = (url ?? "").trim();
  if (!safeUrl) return null;

  if (safeUrl.startsWith("/api/v1/exercise/media/file/")) {
    const fileName = safeUrl.slice("/api/v1/exercise/media/file/".length);
    const localPath = path.resolve(storageRoot, fileName);
    try {
      await fs.access(localPath);
      if (isSvgPath(localPath)) return null;
      return localPath;
    } catch {
      return null;
    }
  }

  if (safeUrl.startsWith("/images/")) {
    const localPath = path.resolve(projectRoot, "public", safeUrl.slice(1));
    try {
      await fs.access(localPath);
      if (isSvgPath(localPath)) return null;
      return localPath;
    } catch {
      return null;
    }
  }

  if (!safeUrl.startsWith("http://") && !safeUrl.startsWith("https://")) {
    return null;
  }
  if (!allowRemoteFetch) {
    return null;
  }

  if (isSvgPath(safeUrl)) {
    return null;
  }
  try {
    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent": "somaticbuilding-video-backfill"
      }
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("svg")) {
      return null;
    }

    const extension = safeUrl.toLowerCase().includes(".png")
      ? ".png"
      : safeUrl.toLowerCase().includes(".webp")
      ? ".webp"
      : ".jpg";
    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.resolve(tempRoot, `image-${id}-${Date.now()}${extension}`);
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
};

const renderFromImage = async (imagePath, outputPath, seconds) => {
  const args = [
    "-y",
    "-loop",
    "1",
    "-framerate",
    "30",
    "-t",
    String(seconds),
    "-i",
    imagePath,
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath
  ];
  const result = await runProcess(ffmpegCommand, args);
  return result.code === 0;
};

const renderFallback = async (outputPath, seconds) => {
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=#121826:s=1280x720:d=${seconds}`,
    "-vf",
    "format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath
  ];
  const result = await runProcess(ffmpegCommand, args);
  return result.code === 0;
};

const sanitizeName = (value) => {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "exercise";
};

const cleanup = async () => {
  try {
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
};

await fs.mkdir(storageRoot, { recursive: true });

try {
  const rows = await readMissingExercises();
  console.log(`Found ${rows.length} exercises missing video media.`);
  if (rows.length === 0) {
    process.exit(0);
  }

  const insertedRows = [];
  const generatedFiles = [];
  let generatedCount = 0;
  let failedCount = 0;
  let fallbackCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const localImage = await ensureLocalImage(row.imageUrl, row.id);
    const fileName = `video-auto-${row.id}-${sanitizeName(row.name)}-${Date.now()}.mp4`;
    const outputPath = path.resolve(storageRoot, fileName);
    let success = false;

    if (localImage) {
      success = await renderFromImage(localImage, outputPath, defaultDuration);
    }
    if (!success) {
      success = await renderFallback(outputPath, defaultDuration);
      if (success) {
        fallbackCount += 1;
      }
    }

    if (!success) {
      failedCount += 1;
      console.warn(`Failed to generate video for exercise #${row.id} ${row.name}`);
      continue;
    }

    generatedCount += 1;
    generatedFiles.push(outputPath);
    insertedRows.push({
      exerciseId: row.id,
      url: `/api/v1/exercise/media/file/${fileName}`
    });
    console.log(
      `[${index + 1}/${rows.length}] generated video for #${row.id} ${row.name} -> ${fileName}`
    );
  }

  if (insertedRows.length === 0) {
    console.log("No video generated, skipping DB insert.");
    process.exit(0);
  }

  const statements = ["SET NAMES utf8mb4;"];
  for (const row of insertedRows) {
    statements.push(
      `INSERT INTO exercise_media (
        exercise_id,
        media_type,
        url,
        cover_flag,
        create_time,
        update_time,
        is_deleted
      )
      SELECT
        ${toSqlValue(row.exerciseId)},
        'video',
        ${toSqlValue(row.url)},
        0,
        NOW(3),
        NOW(3),
        0
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM exercise_media m
        WHERE m.exercise_id = ${toSqlValue(row.exerciseId)}
          AND m.media_type = 'video'
          AND m.is_deleted = 0
      );`
    );
  }
  statements.push(
    "SELECT COUNT(*) AS total_video_media FROM exercise_media WHERE is_deleted = 0 AND media_type = 'video';"
  );

  if (dryRun) {
    await Promise.all(
      generatedFiles.map((filePath) =>
        fs.rm(filePath, { force: true }).catch(() => undefined)
      )
    );
    console.log(
      `Dry run completed. generated=${generatedCount}, fallback=${fallbackCount}, failed=${failedCount}, insertCandidates=${insertedRows.length}`
    );
  } else {
    const sql = statements.join("\n\n");
    const result = await runMysqlWithInput(sql);
    console.log(
      `Backfill completed. generated=${generatedCount}, fallback=${fallbackCount}, failed=${failedCount}, insertedCandidates=${insertedRows.length}`
    );
    if (result.stderr.trim()) {
      console.error(result.stderr.trim());
    }
    console.log(result.stdout.trim());
  }
} finally {
  await cleanup();
}
