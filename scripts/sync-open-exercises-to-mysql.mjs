import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(
  __dirname,
  "..",
  "src",
  "shared",
  "data",
  "open-exercises.json"
);

const dbConfig = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? "3308"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "123456",
  database: process.env.MYSQL_DATABASE ?? "somaticbuilding_db"
};

const validMuscleTags = [
  "Abdominals",
  "Abductors",
  "Adductors",
  "Biceps",
  "Calves",
  "Chest",
  "Forearms",
  "Glutes",
  "Hamstrings",
  "Lats",
  "Lower Back",
  "Middle Back",
  "Neck",
  "Quadriceps",
  "Shoulders",
  "Traps",
  "Triceps"
];

const validEquipmentTags = [
  "Bands",
  "Barbell",
  "Bodyweight",
  "Cable",
  "Dumbbell",
  "E Z Curl Bar",
  "Exercise Ball",
  "Foam Roll",
  "Kettlebells",
  "Machine",
  "Medicine Ball",
  "Other"
];

const titleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const clampString = (value, maxLength, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
};

const normalizeNameKey = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapeSql = (value) =>
  String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");

const toSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${escapeSql(value)}'`;
};

const toDifficultyNumber = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "easy" || normalized === "beginner") return 1;
  if (normalized === "hard" || normalized === "advanced" || normalized === "expert") return 3;
  return 2;
};

const toDifficultyTag = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "easy" || normalized === "beginner") return "Beginner";
  if (normalized === "hard" || normalized === "advanced" || normalized === "expert") return "Expert";
  return "Intermediate";
};

const toCategoryTag = (movementPattern) => {
  const normalized =
    typeof movementPattern === "string" ? movementPattern.trim().toLowerCase() : "";
  if (normalized.includes("cardio")) return "Cardio";
  if (normalized.includes("stretch") || normalized.includes("flexibility")) return "Stretching";
  if (normalized.includes("plyometric")) return "Plyometrics";
  if (normalized.includes("powerlifting")) return "Powerlifting";
  if (normalized.includes("olympic")) return "Olympic Weightlifting";
  if (normalized.includes("strongman")) return "Strongman";
  return "Strength";
};

const toEquipmentTag = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "Bodyweight";
  if (["body only", "bodyweight", "body weight", "none"].includes(normalized)) {
    return "Bodyweight";
  }
  if (normalized.includes("kettlebell")) return "Kettlebells";
  if (normalized.includes("dumbbell")) return "Dumbbell";
  if (normalized.includes("barbell")) return "Barbell";
  if (normalized.includes("machine")) return "Machine";
  if (normalized.includes("cable")) return "Cable";
  if (normalized.includes("band")) return "Bands";
  if (normalized.includes("medicine ball")) return "Medicine Ball";
  if (normalized.includes("exercise ball")) return "Exercise Ball";
  if (normalized.includes("foam roll")) return "Foam Roll";
  if (normalized.includes("ez curl") || normalized.includes("e-z curl")) return "E Z Curl Bar";

  const fallback = titleCase(normalized.replace(/-/g, " "));
  return validEquipmentTags.includes(fallback) ? fallback : "Other";
};

const toMuscleTag = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "";

  const map = [
    ["abdom", "Abdominals"],
    ["core", "Abdominals"],
    ["abductor", "Abductors"],
    ["adductor", "Adductors"],
    ["bicep", "Biceps"],
    ["calf", "Calves"],
    ["chest", "Chest"],
    ["forearm", "Forearms"],
    ["glute", "Glutes"],
    ["hamstring", "Hamstrings"],
    ["lat", "Lats"],
    ["lower back", "Lower Back"],
    ["middle back", "Middle Back"],
    ["mid back", "Middle Back"],
    ["neck", "Neck"],
    ["quad", "Quadriceps"],
    ["shoulder", "Shoulders"],
    ["trap", "Traps"],
    ["tricep", "Triceps"]
  ];

  for (const [needle, tag] of map) {
    if (normalized.includes(needle)) return tag;
  }
  return "";
};

const runMysql = (sql) =>
  new Promise((resolve, reject) => {
    const args = [
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

    const child = spawn("mysql", args, {
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

const raw = await fs.readFile(inputPath, "utf-8");
const payload = JSON.parse(raw);
if (!Array.isArray(payload)) {
  throw new Error("open-exercises.json must be an array.");
}

const dedupedRows = [];
const seenKeys = new Set();
for (const item of payload) {
  const name = clampString(item?.name, 128);
  if (!name) continue;

  const dedupeKey = normalizeNameKey(name);
  if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
  seenKeys.add(dedupeKey);

  const primaryMuscleInput =
    clampString(item?.primaryMuscle, 64) || clampString(item?.movementPattern, 64, "General");
  const equipmentTag = toEquipmentTag(item?.equipmentTag);
  const difficulty = toDifficultyNumber(item?.difficulty);
  const difficultyTag = toDifficultyTag(item?.difficulty);
  const categoryTag = toCategoryTag(item?.movementPattern);
  const muscleTag = toMuscleTag(primaryMuscleInput);

  dedupedRows.push({
    name,
    primaryMuscle: primaryMuscleInput,
    equipment: equipmentTag,
    difficulty,
    description: clampString(item?.description, 60000, ""),
    imageUrl: clampString(item?.imageUrl, 255, ""),
    categoryTag,
    difficultyTag,
    equipmentTag,
    muscleTag: validMuscleTags.includes(muscleTag) ? muscleTag : ""
  });
}

if (dedupedRows.length === 0) {
  throw new Error("No exercise rows available for import.");
}

const statements = [];
statements.push("SET NAMES utf8mb4;");
statements.push("SET @now := NOW(3);");
statements.push(
  `CREATE TEMPORARY TABLE tmp_exercise_import (
    name VARCHAR(128) NOT NULL,
    primary_muscle VARCHAR(64) NOT NULL,
    equipment VARCHAR(64) NOT NULL,
    difficulty TINYINT NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(255) NULL,
    category_tag VARCHAR(64) NOT NULL,
    difficulty_tag VARCHAR(64) NOT NULL,
    equipment_tag VARCHAR(64) NOT NULL,
    muscle_tag VARCHAR(64) NULL
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
);

const chunkSize = 200;
for (let start = 0; start < dedupedRows.length; start += chunkSize) {
  const chunk = dedupedRows.slice(start, start + chunkSize);
  const values = chunk
    .map((row) =>
      `(${[
        toSqlValue(row.name),
        toSqlValue(row.primaryMuscle),
        toSqlValue(row.equipment),
        toSqlValue(row.difficulty),
        toSqlValue(row.description),
        toSqlValue(row.imageUrl),
        toSqlValue(row.categoryTag),
        toSqlValue(row.difficultyTag),
        toSqlValue(row.equipmentTag),
        toSqlValue(row.muscleTag)
      ].join(", ")})`
    )
    .join(",\n");

  statements.push(
    `INSERT INTO tmp_exercise_import (
      name,
      primary_muscle,
      equipment,
      difficulty,
      description,
      image_url,
      category_tag,
      difficulty_tag,
      equipment_tag,
      muscle_tag
    ) VALUES ${values};`
  );
}

statements.push("SET @before_count := (SELECT COUNT(*) FROM exercise WHERE is_deleted = 0);");
statements.push(
  `INSERT INTO exercise (
    name,
    primary_muscle,
    equipment,
    difficulty,
    description,
    status,
    create_time,
    update_time,
    is_deleted
  )
  SELECT
    t.name,
    t.primary_muscle,
    t.equipment,
    t.difficulty,
    t.description,
    1,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  LEFT JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  WHERE e.id IS NULL;`
);
statements.push("SET @after_count := (SELECT COUNT(*) FROM exercise WHERE is_deleted = 0);");
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
    e.id,
    'image',
    t.image_url,
    1,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  LEFT JOIN exercise_media m
    ON m.exercise_id = e.id
    AND m.url = t.image_url
    AND m.is_deleted = 0
  WHERE t.image_url IS NOT NULL
    AND t.image_url <> ''
    AND m.id IS NULL;`
);
statements.push(
  `INSERT IGNORE INTO exercise_tag_map (
    exercise_id,
    tag_id,
    create_time,
    update_time,
    is_deleted
  )
  SELECT
    e.id,
    tag.id,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  JOIN exercise_tag tag
    ON tag.tag_type = 'category'
    AND tag.tag_name = t.category_tag
    AND tag.is_deleted = 0;`
);
statements.push(
  `INSERT IGNORE INTO exercise_tag_map (
    exercise_id,
    tag_id,
    create_time,
    update_time,
    is_deleted
  )
  SELECT
    e.id,
    tag.id,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  JOIN exercise_tag tag
    ON tag.tag_type = 'difficulty'
    AND tag.tag_name = t.difficulty_tag
    AND tag.is_deleted = 0;`
);
statements.push(
  `INSERT IGNORE INTO exercise_tag_map (
    exercise_id,
    tag_id,
    create_time,
    update_time,
    is_deleted
  )
  SELECT
    e.id,
    tag.id,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  JOIN exercise_tag tag
    ON tag.tag_type = 'equipment'
    AND tag.tag_name = t.equipment_tag
    AND tag.is_deleted = 0;`
);
statements.push(
  `INSERT IGNORE INTO exercise_tag_map (
    exercise_id,
    tag_id,
    create_time,
    update_time,
    is_deleted
  )
  SELECT
    e.id,
    tag.id,
    @now,
    @now,
    0
  FROM tmp_exercise_import t
  JOIN exercise e
    ON e.name = t.name
    AND e.is_deleted = 0
  JOIN exercise_tag tag
    ON tag.tag_type = 'muscle'
    AND tag.tag_name = t.muscle_tag
    AND tag.is_deleted = 0
  WHERE t.muscle_tag IS NOT NULL
    AND t.muscle_tag <> '';`
);
statements.push(
  "SELECT @before_count AS before_count, @after_count AS after_count, (@after_count - @before_count) AS inserted_count;"
);
statements.push("SELECT COUNT(*) AS total_exercise FROM exercise WHERE is_deleted = 0;");
statements.push("SELECT COUNT(*) AS total_media FROM exercise_media WHERE is_deleted = 0;");
statements.push("SELECT COUNT(*) AS total_tag_map FROM exercise_tag_map WHERE is_deleted = 0;");

const sql = statements.join("\n\n");
const result = await runMysql(sql);

console.log(`Loaded ${dedupedRows.length} rows from ${inputPath}`);
if (result.stderr.trim()) {
  console.error(result.stderr.trim());
}
console.log(result.stdout.trim());
