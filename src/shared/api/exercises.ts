import { httpGet, httpPost, httpPostForm } from "./http";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const readNumber = (source: UnknownRecord, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const readString = (source: UnknownRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
};

const readArray = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const difficultyLabel = (value: unknown) => {
  if (typeof value === "number") {
    if (value <= 1) return "Easy";
    if (value === 2) return "Medium";
    return "Hard";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("beginner") || normalized.includes("easy")) return "Easy";
    if (normalized.includes("intermediate") || normalized.includes("medium")) return "Medium";
    if (normalized.includes("expert") || normalized.includes("hard")) return "Hard";
  }

  return "Medium";
};

const abilityFromDifficulty = (difficulty: string) => {
  if (difficulty === "Easy") return "Beginner";
  if (difficulty === "Hard") return "Advanced";
  return "Intermediate";
};

const EXERCISE_DB_BASE_URL = "https://oss.exercisedb.dev";
const exerciseDbGifCache = new Map<string, string | null>();
const PLACEHOLDER_COVER_PREFIX = "/images/exercises/placeholders/";
const LOCAL_PLACEHOLDER_COVERS = {
  general: "/images/exercises/placeholders/general.svg",
  strength: "/images/exercises/placeholders/strength.svg",
  cardio: "/images/exercises/placeholders/cardio.svg",
  stretching: "/images/exercises/placeholders/stretching.svg"
};

const normalizeSearchKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const looksLikeGif = (value: string) => /\.gif(?:$|\?)/i.test(value);

const looksLikePlaceholderCover = (value: string) =>
  String(value ?? "").toLowerCase().startsWith(PLACEHOLDER_COVER_PREFIX);

const resolveLocalPlaceholderCover = (
  movementPattern: string,
  equipment: string,
  difficulty: string
) => {
  const haystack = `${movementPattern} ${equipment} ${difficulty}`.toLowerCase();
  if (
    haystack.includes("cardio") ||
    haystack.includes("aerob") ||
    haystack.includes("run") ||
    haystack.includes("cycle") ||
    haystack.includes("interval")
  ) {
    return LOCAL_PLACEHOLDER_COVERS.cardio;
  }
  if (
    haystack.includes("stretch") ||
    haystack.includes("mobility") ||
    haystack.includes("flex") ||
    haystack.includes("yoga")
  ) {
    return LOCAL_PLACEHOLDER_COVERS.stretching;
  }
  if (!haystack.trim()) {
    return LOCAL_PLACEHOLDER_COVERS.general;
  }
  return LOCAL_PLACEHOLDER_COVERS.strength;
};

const resolveExerciseCoverUrl = (
  value: string,
  movementPattern: string,
  equipment: string,
  difficulty: string
) => {
  if (value && !looksLikePlaceholderCover(value) && !looksLikeGif(value)) {
    return value;
  }
  return resolveLocalPlaceholderCover(movementPattern, equipment, difficulty);
};

const fetchExerciseDbGifUrl = async (exerciseName: string) => {
  const normalized = normalizeSearchKey(exerciseName);
  if (!normalized) return null;
  if (exerciseDbGifCache.has(normalized)) {
    return exerciseDbGifCache.get(normalized) ?? null;
  }

  try {
    const searchUrl = new URL("/api/v1/exercises/search", EXERCISE_DB_BASE_URL);
    searchUrl.searchParams.set("search", exerciseName);
    searchUrl.searchParams.set("threshold", "0.35");

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      exerciseDbGifCache.set(normalized, null);
      return null;
    }

    const payload = (await response.json()) as unknown;
    const record = isRecord(payload) ? payload : {};
    const candidates = Array.isArray(record.data) ? record.data : [];
    const match = candidates
      .map((item) => (isRecord(item) ? item : {}))
      .find((item) => typeof item.gifUrl === "string" && item.gifUrl.trim());

    const gifUrl = match ? readString(match, ["gifUrl"], "") : "";
    exerciseDbGifCache.set(normalized, gifUrl || null);
    return gifUrl || null;
  } catch {
    exerciseDbGifCache.set(normalized, null);
    return null;
  }
};

export type ExerciseCardData = {
  id: string;
  name: string;
  imageUrl: string;
  movementPattern: string;
  abilityTag: string;
  equipmentTag: string;
  difficulty: string;
};

export type ExerciseDetailData = ExerciseCardData & {
  description: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  categoryTags?: string[];
  videoUrl?: string;
};

export type ExerciseTagData = {
  id: number;
  tagType: string;
  tagName: string;
};

export type CreateCustomExercisePayload = {
  name: string;
  primaryMuscle?: string;
  equipment?: string;
  difficulty?: number;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
};

export type UploadExerciseMediaPayload = {
  file: File;
  mediaType: "image" | "video";
};

const normalizeExerciseCard = (raw: unknown): ExerciseCardData => {
  const record = isRecord(raw) ? raw : {};
  const difficulty = difficultyLabel(
    record.difficulty ?? record.difficulty_level ?? record.level
  );
  const primaryMuscle = readString(record, ["primaryMuscle", "primary_muscle"], "General");
  const equipment = readString(record, ["equipment"], "Bodyweight");
  const coverUrl = readString(record, ["coverUrl", "cover_url", "imageUrl", "image_url"], "");

  return {
    id: String(readNumber(record, ["id"], 0) || readString(record, ["id"], "")),
    name: readString(record, ["name"], "Unknown Exercise"),
    imageUrl: resolveExerciseCoverUrl(coverUrl, primaryMuscle || "General", equipment, difficulty),
    movementPattern: primaryMuscle || "General",
    abilityTag: abilityFromDifficulty(difficulty),
    equipmentTag: equipment || "Bodyweight",
    difficulty
  };
};

export const fetchExerciseList = async (params?: {
  keyword?: string;
  page?: number;
  pageSize?: number;
  tagIds?: number[];
}) => {
  const query = new URLSearchParams();
  if (params?.keyword) query.set("keyword", params.keyword);
  if (params?.tagIds && params.tagIds.length > 0) {
    query.set("tag_ids", params.tagIds.join(","));
  }
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.pageSize ?? 2000));

  const data = await httpGet<unknown>(`/api/v1/exercise/list?${query.toString()}`);
  const record = isRecord(data) ? data : {};
  const list = readArray(record, ["list", "items", "records"]).map(normalizeExerciseCard);
  const total = readNumber(record, ["total"], list.length);

  return {
    list,
    total
  };
};

export const fetchExerciseTags = async () => {
  const data = await httpGet<unknown>("/api/v1/exercise/tags");
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records"])
    : [];

  return list
    .map((item) => (isRecord(item) ? item : {}))
    .map((record) => ({
      id: readNumber(record, ["id"], 0),
      tagType: readString(record, ["tagType", "tag_type"], ""),
      tagName: readString(record, ["tagName", "tag_name"], "")
    }))
    .filter((tag) => tag.id > 0 && tag.tagType && tag.tagName) as ExerciseTagData[];
};

export const fetchExerciseDetail = async (id: string) => {
  const detailData = await httpGet<unknown>(`/api/v1/exercise/${id}`);
  const detailRecord = isRecord(detailData) ? detailData : {};
  const base = normalizeExerciseCard(detailRecord);
  const description = readString(detailRecord, ["description"], "");

  let imageUrl = base.imageUrl;
  let videoUrl = "";
  try {
    const mediaData = await httpGet<unknown>(`/api/v1/exercise/${id}/media`);
    const mediaList = Array.isArray(mediaData)
      ? mediaData
      : isRecord(mediaData)
      ? readArray(mediaData, ["list", "items"])
      : [];
    if (mediaList.length > 0) {
      const sorted = mediaList
        .map((item) => (isRecord(item) ? item : {}))
        .sort(
          (a, b) =>
            readNumber(b, ["coverFlag", "cover_flag"], 0) -
            readNumber(a, ["coverFlag", "cover_flag"], 0)
        );
      const imageMedia = sorted.find((item) => {
        const mediaType = readString(item, ["mediaType", "media_type"], "").toLowerCase();
        return mediaType === "image" || !mediaType;
      });
      const fromMedia = imageMedia
        ? readString(imageMedia, ["url", "coverUrl", "cover_url"], "")
        : "";
      if (fromMedia) {
        imageUrl = resolveExerciseCoverUrl(
          fromMedia,
          base.movementPattern,
          base.equipmentTag,
          base.difficulty
        );
      }

      const videoMedia = sorted.find((item) =>
        readString(item, ["mediaType", "media_type"], "").toLowerCase() === "video"
      );
      if (videoMedia) {
        videoUrl = readString(videoMedia, ["url", "videoUrl", "video_url"], "");
      } else {
        const gifMedia = sorted.find((item) => {
          const url = readString(item, ["url", "coverUrl", "cover_url"], "");
          const mediaType = readString(item, ["mediaType", "media_type"], "").toLowerCase();
          return (mediaType === "image" && looksLikeGif(url)) || looksLikeGif(url);
        });
        if (gifMedia) {
          videoUrl = readString(gifMedia, ["url", "coverUrl", "cover_url"], "");
        }
      }
    }
  } catch {
    // keep detail cover fallback
  }

  let primaryMuscle = readString(detailRecord, ["primaryMuscle", "primary_muscle"], base.movementPattern);
  let secondaryMuscles: string[] = [];
  let categoryTags: string[] = [];
  try {
    const tagsData = await httpGet<unknown>(`/api/v1/exercise/${id}/tags`);
    const rawTags = Array.isArray(tagsData)
      ? tagsData
      : isRecord(tagsData)
      ? readArray(tagsData, ["list", "items", "records"])
      : [];
    const tags = rawTags.map((item) => (isRecord(item) ? item : {}));

    const muscleTags = tags
      .filter(
        (item) => readString(item, ["tagType", "tag_type"], "").toLowerCase() === "muscle"
      )
      .map((item) => readString(item, ["tagName", "tag_name"], ""))
      .filter(Boolean);
    if (muscleTags.length > 0) {
      primaryMuscle = muscleTags[0];
      secondaryMuscles = Array.from(new Set(muscleTags.slice(1)));
    }

    categoryTags = tags
      .filter(
        (item) => readString(item, ["tagType", "tag_type"], "").toLowerCase() === "category"
      )
      .map((item) => readString(item, ["tagName", "tag_name"], ""))
      .filter(Boolean);
  } catch {
    // keep defaults when tag API is unavailable
  }

  imageUrl = resolveExerciseCoverUrl(
    imageUrl,
    primaryMuscle || base.movementPattern,
    base.equipmentTag,
    base.difficulty
  );

  const isAutoGeneratedLocalVideo =
    videoUrl.startsWith("/api/v1/exercise/media/file/video-auto-") ||
    videoUrl.startsWith("/api/v1/exercise/media/file/clip-");
  if (!videoUrl || isAutoGeneratedLocalVideo) {
    const remoteGifUrl = await fetchExerciseDbGifUrl(
      base.name || readString(detailRecord, ["name"], "")
    );
    if (remoteGifUrl) {
      videoUrl = remoteGifUrl;
    }
  }

  return {
    ...base,
    imageUrl,
    description,
    primaryMuscle,
    secondaryMuscles,
    categoryTags,
    videoUrl: videoUrl || undefined
  } as ExerciseDetailData;
};

export const createCustomExercise = async (payload: CreateCustomExercisePayload) => {
  const data = await httpPost<unknown>("/api/v1/exercise/custom", {
    name: payload.name,
    primaryMuscle: payload.primaryMuscle,
    primary_muscle: payload.primaryMuscle,
    equipment: payload.equipment,
    difficulty: payload.difficulty,
    description: payload.description,
    coverUrl: payload.coverUrl,
    cover_url: payload.coverUrl,
    videoUrl: payload.videoUrl,
    video_url: payload.videoUrl
  });
  return normalizeExerciseCard(data);
};

export const uploadExerciseMedia = async (payload: UploadExerciseMediaPayload) => {
  if (!(payload.file instanceof File)) {
    throw new Error("No file selected.");
  }
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("mediaType", payload.mediaType);

  const data = await httpPostForm<unknown>("/api/v1/exercise/media/upload", formData);
  const record = isRecord(data) ? data : {};
  const url = readString(record, ["url", "mediaUrl", "media_url"], "");
  if (!url) {
    throw new Error("Media upload succeeded but URL is missing.");
  }
  return {
    url,
    fileName: readString(record, ["fileName", "file_name"], ""),
    mediaType: readString(record, ["mediaType", "media_type"], payload.mediaType),
    contentType: readString(record, ["contentType", "content_type"], ""),
    size: readNumber(record, ["size"], payload.file.size)
  };
};
