import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const YUHONAS_SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const YUHONAS_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const LONGHAUL_SOURCES = [
  {
    url: "https://raw.githubusercontent.com/longhaul-fitness/exercises/main/strength.json",
    movementPattern: "Strength",
    abilityTag: "Intermediate",
    difficulty: "Medium"
  },
  {
    url: "https://raw.githubusercontent.com/longhaul-fitness/exercises/main/cardio.json",
    movementPattern: "Cardio",
    abilityTag: "Beginner",
    difficulty: "Easy"
  },
  {
    url: "https://raw.githubusercontent.com/longhaul-fitness/exercises/main/flexibility.json",
    movementPattern: "Stretching",
    abilityTag: "Beginner",
    difficulty: "Easy"
  }
];

const SOURCE_PRIORITIES = {
  "yuhonas/free-exercise-db": 2,
  "longhaul-fitness/exercises": 1
};

const PLACEHOLDER_IMAGES = {
  strength: "/images/exercises/placeholders/strength.svg",
  cardio: "/images/exercises/placeholders/cardio.svg",
  stretching: "/images/exercises/placeholders/stretching.svg",
  general: "/images/exercises/placeholders/general.svg"
};

const titleCase = (value) => {
  if (!value) return "Unknown";
  return value
    .toString()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
};

const difficultyFromLevel = (level) => {
  switch ((level || "").toLowerCase()) {
    case "beginner":
      return "Easy";
    case "intermediate":
      return "Medium";
    case "expert":
      return "Hard";
    default:
      return "Medium";
  }
};

const toEquipment = (equipment) => {
  if (!equipment) return "Bodyweight";
  if (equipment.toLowerCase() === "body only") return "Bodyweight";
  return titleCase(equipment.replace(/-/g, " "));
};

const resolvePlaceholderImage = (movementPattern) => {
  const normalized =
    typeof movementPattern === "string" ? movementPattern.trim().toLowerCase() : "";
  if (!normalized) return PLACEHOLDER_IMAGES.general;
  if (normalized.includes("cardio")) return PLACEHOLDER_IMAGES.cardio;
  if (normalized.includes("stretch") || normalized.includes("flexibility")) {
    return PLACEHOLDER_IMAGES.stretching;
  }
  if (
    normalized.includes("strength") ||
    normalized.includes("power") ||
    normalized.includes("compound")
  ) {
    return PLACEHOLDER_IMAGES.strength;
  }
  return PLACEHOLDER_IMAGES.general;
};

const normalizeNameKey = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const readArray = (value) => (Array.isArray(value) ? value : []);

const buildDescription = (segments) => {
  const normalized = segments
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.join(" ").slice(0, 1800);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, attempts = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "somatic-building-importer"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(attempt * 500);
      }
    }
  }

  throw lastError;
};

const mapYuhonasExercise = (exercise) => {
  const name =
    typeof exercise?.name === "string" && exercise.name.trim()
      ? exercise.name.trim()
      : "Unknown";
  const level = typeof exercise?.level === "string" ? exercise.level : "";
  const movementPattern =
    typeof exercise?.category === "string" && exercise.category.trim()
      ? titleCase(exercise.category)
      : typeof exercise?.mechanic === "string" && exercise.mechanic.trim()
      ? titleCase(exercise.mechanic)
      : "General";
  const coverImage =
    Array.isArray(exercise?.images) && exercise.images[0]
      ? `${YUHONAS_IMAGE_BASE}${exercise.images[0]}`
      : resolvePlaceholderImage(movementPattern);

  return {
    id: `open-yuhonas-${String(exercise?.id ?? name)}`,
    name,
    imageUrl: coverImage,
    movementPattern,
    abilityTag: titleCase(level || "intermediate"),
    equipmentTag: toEquipment(exercise?.equipment),
    difficulty: difficultyFromLevel(level),
    source: "yuhonas/free-exercise-db",
    license: "Unlicense"
  };
};

const mapLonghaulExercise = (exercise, config) => {
  const name =
    typeof exercise?.name === "string" && exercise.name.trim()
      ? exercise.name.trim()
      : "Unknown";
  const primaryMuscle = readArray(exercise?.primaryMuscles)[0];
  const description = buildDescription([
    ...readArray(exercise?.steps),
    typeof exercise?.instructions?.[0] === "string" ? exercise.instructions[0] : "",
    typeof exercise?.notes === "string" ? exercise.notes : ""
  ]);

  return {
    id: `open-longhaul-${String(exercise?.slug ?? exercise?.pk ?? name)}`,
    name,
    imageUrl: resolvePlaceholderImage(config.movementPattern),
    movementPattern: config.movementPattern,
    abilityTag: config.abilityTag,
    equipmentTag: "Bodyweight",
    difficulty: config.difficulty,
    description,
    primaryMuscle: typeof primaryMuscle === "string" ? titleCase(primaryMuscle) : "General",
    source: "longhaul-fitness/exercises",
    license: "MIT"
  };
};

const dedupeExercises = (items) => {
  const dedupedByName = new Map();

  for (const item of items) {
    const key = normalizeNameKey(item.name || "");
    if (!key) continue;

    if (!dedupedByName.has(key)) {
      dedupedByName.set(key, item);
      continue;
    }

    const previous = dedupedByName.get(key);
    const previousPriority = SOURCE_PRIORITIES[previous.source] ?? 0;
    const nextPriority = SOURCE_PRIORITIES[item.source] ?? 0;

    const shouldReplace =
      (item.imageUrl && !previous.imageUrl) ||
      nextPriority > previousPriority ||
      (nextPriority === previousPriority && item.name.length > previous.name.length);

    if (shouldReplace) {
      dedupedByName.set(key, item);
    }
  }

  return [...dedupedByName.values()];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  __dirname,
  "..",
  "src",
  "shared",
  "data",
  "open-exercises.json"
);

const yuhonasPayload = await fetchJson(YUHONAS_SOURCE_URL);
if (!Array.isArray(yuhonasPayload)) {
  throw new Error("Unexpected payload format from yuhonas/free-exercise-db.");
}

const longhaulPayloadList = await Promise.all(
  LONGHAUL_SOURCES.map(async (source) => {
    const payload = await fetchJson(source.url);
    if (!Array.isArray(payload)) {
      throw new Error(`Unexpected payload format from ${source.url}`);
    }
    return {
      source,
      payload
    };
  })
);

const mappedFromYuhonas = yuhonasPayload.map(mapYuhonasExercise);
const mappedFromLonghaul = longhaulPayloadList.flatMap(({ source, payload }) =>
  payload.map((exercise) => mapLonghaulExercise(exercise, source))
);

const combined = [...mappedFromYuhonas, ...mappedFromLonghaul];
const deduped = dedupeExercises(combined)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((item, index) => ({
    ...item,
    id: String(index + 1),
    imageUrl: item.imageUrl || resolvePlaceholderImage(item.movementPattern)
  }));

await fs.writeFile(outputPath, JSON.stringify(deduped, null, 2), "utf-8");
console.log(`Imported ${deduped.length} exercises -> ${outputPath}`);
console.log(
  `Source stats: yuhonas=${mappedFromYuhonas.length}, longhaul=${mappedFromLonghaul.length}, combined=${combined.length}, deduped=${deduped.length}`
);
