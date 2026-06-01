import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronRight,
  Dumbbell,
  GripVertical,
  Layers,
  Plus,
  Sparkles,
  Trash2
} from "lucide-react";
import { Input } from "../../shared/components/ui/input";
import { exercises } from "../../shared/data/exercises";
import { fetchExerciseList } from "../../shared/api/exercises";
import {
  createWorkoutExercise,
  createWorkoutGroup,
  createWorkoutSession,
  fetchWorkoutTemplateDetail,
  getWorkoutSession,
  type WorkoutSession
} from "../../shared/api/workout";

const trainingStyles = [
  "Strength & Conditioning",
  "Bodybuilding",
  "CrossFit",
  "Functional",
  "Mobility / Yoga",
  "Athletic",
  "Rehab"
];

const blockTemplates = [
  "Warmup",
  "Activation",
  "Power",
  "Strength",
  "Accessory",
  "Conditioning",
  "Cooldown"
];

const styleBlocksMap: Record<string, string[]> = {
  "Strength & Conditioning": [
    "Warmup",
    "Activation",
    "Power",
    "Strength",
    "Accessory",
    "Conditioning",
    "Cooldown"
  ],
  Bodybuilding: ["Warmup", "Compound", "Secondary", "Isolation", "Pump", "Cooldown"],
  CrossFit: ["Warmup", "Skill", "Strength", "WOD", "Cooldown"],
  Functional: ["Warmup", "Movement Prep", "Strength", "Circuit", "Finisher", "Cooldown"],
  "Mobility / Yoga": ["Warmup", "Mobility", "Flow", "Stretch", "Cooldown"],
  Athletic: ["Warmup", "Speed", "Agility", "Power", "Strength", "Conditioning", "Cooldown"],
  Rehab: ["Warmup", "Activation", "Corrective", "Strength", "Mobility", "Cooldown"]
};

const groupMethods = ["Straight Sets", "Superset", "Circuit", "Interval", "HIIT"];

const DEMO_USER_ID = 1;

type CartExercise = {
  id: string;
  name: string;
};

type ExerciseCatalogEntry = {
  id: string;
  name: string;
  imageUrl?: string;
};

type BlockExercise = {
  uid: string;
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;
  time: number;
  rounds: number;
  source: "cart" | "template";
};

type BlockGroup = {
  id: string;
  method: string;
  items: BlockExercise[];
};

type WorkoutBlock = {
  id: string;
  title: string;
  groups: BlockGroup[];
};

type WorkoutTemplate = {
  id: string;
  name: string;
  style?: string;
  cartIds?: string[];
  exerciseIds?: string[];
  blocks?: {
    id?: string;
    title: string;
    groups?: { id?: string; method: string; items: BlockExercise[] }[];
    items?: BlockExercise[];
  }[];
};

type WorkoutBuilderDraft = {
  sessionName: string;
  trainingStyle: string;
  templatePoolIds: string[];
  blocks: WorkoutBlock[];
  activeBlockId: string;
  activeGroupByBlock: Record<string, string>;
  collapsedBlocks: Record<string, boolean>;
};

const blocksMatchStyle = (draftBlocks: WorkoutBlock[], expectedTitles: string[]) => {
  if (draftBlocks.length !== expectedTitles.length) return false;
  return draftBlocks.every((block, index) => block.title === expectedTitles[index]);
};

const createUid = (baseId: string) =>
  `${baseId}-${Math.random().toString(36).slice(2, 8)}`;

const createGroup = (seed: string) => ({
  id: `group-${seed}-${Math.random().toString(36).slice(2, 6)}`,
  method: groupMethods[0],
  items: []
});

const createBlocksFromTitles = (titles: string[]) =>
  titles.map((title, index) => ({
    id: `block-${index}`,
    title,
    groups: [createGroup(`${index}-0`)]
  }));

const cloneBlocksForTemplate = (sourceBlocks: WorkoutBlock[]) =>
  sourceBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    groups: block.groups.map((group) => ({
      id: group.id,
      method: group.method,
      items: group.items.map((item) => ({
        ...item
      }))
    }))
  }));

const hydrateBlocksFromTemplate = (sourceBlocks: WorkoutBlock[]) => {
  const normalized = normalizeWorkoutBlocks(sourceBlocks);
  return normalized.map((block) => ({
    ...block,
    groups: block.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        uid: createUid(item.id)
      }))
    }))
  }));
};

const collectTemplateExerciseIds = (template?: WorkoutTemplate) => {
  if (!template) return [];
  const ids = new Set<string>();
  template.cartIds?.forEach((id) => ids.add(id));
  template.exerciseIds?.forEach((id) => ids.add(id));
  template.blocks?.forEach((block) => {
    block.groups?.forEach((group) => {
      group.items.forEach((item) => ids.add(item.id));
    });
    block.items?.forEach((item) => ids.add(item.id));
  });
  return [...ids];
};

const readStoredUserId = () => {
  if (typeof window === "undefined") return DEMO_USER_ID;
  const keys = [
    "workoutActiveUserId",
    "userId",
    "user_id",
    "authUserId",
    "auth_user_id"
  ];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEMO_USER_ID;
};

const normalizeNameForCompare = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const areLikelySameExerciseName = (left: string, right: string) => {
  const a = normalizeNameForCompare(left);
  const b = normalizeNameForCompare(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = a.split(" ").filter((item) => item.length > 1);
  const bTokens = b.split(" ").filter((item) => item.length > 1);
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  return overlap >= 2;
};

const buildInitialExerciseCatalog = (): ExerciseCatalogEntry[] =>
  exercises.map((exercise) => ({
    id: String(exercise.id),
    name: String(exercise.name ?? "").trim() || `Exercise #${exercise.id}`,
    imageUrl: typeof exercise.imageUrl === "string" ? exercise.imageUrl : ""
  }));

const toExerciseId = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const exerciseNameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readFirstFiniteNumber = (
  source: Record<string, unknown>,
  keys: string[],
  fallback: number
) => {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
};

const sanitizeExerciseMetric = (
  field: keyof Omit<BlockExercise, "uid" | "id" | "name" | "source">,
  value: unknown
) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  const fallback =
    field === "sets"
      ? 3
      : field === "reps"
      ? 8
      : field === "rest"
      ? 60
      : field === "time"
      ? 0
      : 1;
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  if (field === "sets") return Math.max(1, rounded);
  if (field === "reps") return Math.max(0, rounded);
  if (field === "rest") return Math.max(0, rounded);
  if (field === "time") return Math.max(0, rounded);
  return Math.max(1, rounded);
};

const normalizeBlockExercise = (
  raw: unknown,
  fallbackSource: "cart" | "template" = "template"
): BlockExercise => {
  const record = isRecord(raw) ? raw : {};
  const idRaw = record.id ?? record.exerciseId ?? record.exercise_id ?? "0";
  const id = String(idRaw).trim() || "0";
  const nameRaw = typeof record.name === "string" ? record.name.trim() : "";
  const sourceValue =
    record.source === "cart" || record.source === "template"
      ? record.source
      : fallbackSource;
  const uidRaw = typeof record.uid === "string" ? record.uid.trim() : "";

  return {
    uid: uidRaw || createUid(id),
    id,
    name: nameRaw || exerciseNameById.get(id) || `Exercise #${id}`,
    sets: sanitizeExerciseMetric(
      "sets",
      readFirstFiniteNumber(record, ["sets", "set", "setCount", "set_count"], 3)
    ),
    reps: sanitizeExerciseMetric(
      "reps",
      readFirstFiniteNumber(record, ["reps", "rep", "repCount", "rep_count"], 8)
    ),
    rest: sanitizeExerciseMetric(
      "rest",
      readFirstFiniteNumber(record, ["rest", "restSeconds", "rest_seconds"], 60)
    ),
    time: sanitizeExerciseMetric(
      "time",
      readFirstFiniteNumber(record, ["time", "timeSeconds", "time_seconds"], 0)
    ),
    rounds: sanitizeExerciseMetric(
      "rounds",
      readFirstFiniteNumber(record, ["rounds", "round", "roundCount", "round_count"], 1)
    ),
    source: sourceValue
  };
};

const normalizeWorkoutBlocks = (rawBlocks: unknown): WorkoutBlock[] => {
  if (!Array.isArray(rawBlocks)) return [];
  return rawBlocks.map((rawBlock, blockIndex) => {
    const block = isRecord(rawBlock) ? rawBlock : {};
    const titleRaw = typeof block.title === "string" ? block.title.trim() : "";
    const idRaw = typeof block.id === "string" ? block.id.trim() : "";
    const groupsRaw = Array.isArray(block.groups) ? block.groups : [];
    const legacyItemsRaw = Array.isArray(block.items) ? block.items : [];

    const groups: BlockGroup[] =
      groupsRaw.length > 0
        ? groupsRaw.map((rawGroup, groupIndex) => {
            const group = isRecord(rawGroup) ? rawGroup : {};
            const methodRaw = typeof group.method === "string" ? group.method.trim() : "";
            const groupIdRaw = typeof group.id === "string" ? group.id.trim() : "";
            const itemsRaw = Array.isArray(group.items) ? group.items : [];
            return {
              id: groupIdRaw || `group-${blockIndex}-${groupIndex}`,
              method: methodRaw || groupMethods[0],
              items: itemsRaw.map((item) => normalizeBlockExercise(item, "template"))
            };
          })
        : [
            {
              id: `group-${blockIndex}-0`,
              method: groupMethods[0],
              items: legacyItemsRaw.map((item) => normalizeBlockExercise(item, "template"))
            }
          ];

    return {
      id: idRaw || `block-${blockIndex}`,
      title: titleRaw || `Block ${blockIndex + 1}`,
      groups: groups.length > 0 ? groups : [createGroup(`${blockIndex}-0`)]
    };
  });
};

const normalizeActiveGroupByBlock = (
  nextBlocks: WorkoutBlock[],
  rawMap: unknown
): Record<string, string> => {
  const source = isRecord(rawMap) ? rawMap : {};
  return Object.fromEntries(
    nextBlocks.map((block) => {
      const candidate = typeof source[block.id] === "string" ? String(source[block.id]) : "";
      const exists = block.groups.some((group) => group.id === candidate);
      return [block.id, exists ? candidate : block.groups[0]?.id ?? ""];
    })
  );
};

const normalizeCollapsedBlocks = (
  nextBlocks: WorkoutBlock[],
  rawMap: unknown
): Record<string, boolean> => {
  const source = isRecord(rawMap) ? rawMap : {};
  return Object.fromEntries(
    nextBlocks.map((block) => [block.id, Boolean(source[block.id])])
  );
};

const normalizeGroupMethodFromRemoteType = (groupType: string) => {
  const normalized = groupType.trim().toLowerCase();
  if (normalized === "superset") return "Superset";
  if (normalized === "circuit") return "Circuit";
  if (normalized === "interval") return "Interval";
  if (normalized === "hiit") return "HIIT";
  return "Straight Sets";
};

const normalizeTrainingStyleFromRemote = (rawStyle: string) => {
  const trimmed = rawStyle.trim();
  if (trainingStyles.includes(trimmed)) {
    return trimmed;
  }
  return trainingStyles[0];
};

const hydrateBuilderStateFromRemoteSession = (session: WorkoutSession) => {
  const trainingStyle = normalizeTrainingStyleFromRemote(session.trainingStyle ?? "");
  const fallbackTitles = styleBlocksMap[trainingStyle] ?? blockTemplates;
  const remoteBlocks: WorkoutBlock[] = session.blocks
    .map((block, blockIndex) => {
      const groups: BlockGroup[] = block.groups
        .map((group, groupIndex) => {
          const items: BlockExercise[] = group.exercises
            .map((exercise, exerciseIndex) => {
              const safeExerciseId = exercise.exerciseId > 0 ? exercise.exerciseId : 0;
              if (safeExerciseId <= 0) return null;
              const id = String(safeExerciseId);
              const fallbackUidSeed = `${blockIndex}-${groupIndex}-${exerciseIndex}-${id}`;
              return {
                uid: createUid(fallbackUidSeed),
                id,
                name: exercise.exerciseName?.trim() || exerciseNameById.get(id) || `Exercise #${id}`,
                sets: sanitizeExerciseMetric("sets", exercise.sets),
                reps: sanitizeExerciseMetric("reps", exercise.reps),
                rest: sanitizeExerciseMetric("rest", exercise.restSeconds),
                time: sanitizeExerciseMetric("time", exercise.timeSeconds),
                rounds: sanitizeExerciseMetric("rounds", exercise.rounds),
                source: "template"
              };
            })
            .filter((item): item is BlockExercise => Boolean(item));
          if (items.length === 0) return null;

          return {
            id:
              group.id > 0
                ? `group-${group.id}`
                : `group-${block.id > 0 ? block.id : blockIndex}-${groupIndex}`,
            method: normalizeGroupMethodFromRemoteType(group.groupType),
            items
          };
        })
        .filter((group): group is BlockGroup => Boolean(group));

      if (groups.length === 0) return null;
      return {
        id: block.id > 0 ? `block-${block.id}` : `block-${blockIndex}`,
        title: block.blockName?.trim() || `Block ${blockIndex + 1}`,
        groups
      };
    })
    .filter((block): block is WorkoutBlock => Boolean(block));

  const blocks =
    remoteBlocks.length > 0 ? remoteBlocks : createBlocksFromTitles(fallbackTitles);
  const activeBlockId = blocks[0]?.id ?? "block-0";
  const activeGroupByBlock = Object.fromEntries(
    blocks.map((block) => [block.id, block.groups[0]?.id ?? ""])
  );
  const collapsedBlocks = Object.fromEntries(blocks.map((block) => [block.id, false]));
  const templatePoolIds = Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.groups.flatMap((group) => group.items.map((item) => item.id))
      )
    )
  );
  const sessionName = session.sessionName?.trim() || "AI Session";

  return {
    sessionName,
    trainingStyle,
    templatePoolIds,
    blocks,
    activeBlockId,
    activeGroupByBlock,
    collapsedBlocks
  };
};

export function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const initialBlocks = createBlocksFromTitles(blockTemplates);
  const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseCatalogEntry[]>(
    () => buildInitialExerciseCatalog()
  );
  const [sessionName, setSessionName] = useState("Custom Session");
  const [trainingStyle, setTrainingStyle] = useState(trainingStyles[0]);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [templatePoolIds, setTemplatePoolIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);
  const [activeBlockId, setActiveBlockId] = useState(initialBlocks[0].id);
  const [activeGroupByBlock, setActiveGroupByBlock] = useState<Record<string, string>>(
    () => Object.fromEntries(initialBlocks.map((block) => [block.id, block.groups[0].id]))
  );
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialBlocks.map((block) => [block.id, false]))
  );
  const [draggingUid, setDraggingUid] = useState<string | null>(null);
  const [draggingFromBlock, setDraggingFromBlock] = useState<string | null>(null);
  const [draggingFromGroup, setDraggingFromGroup] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const blockScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const selection = window.localStorage.getItem("workoutStyleSelection");
    let selectedStyle = trainingStyles[0];
    let selectedBlocks = blockTemplates;
    if (selection) {
      try {
        const parsed = JSON.parse(selection) as { style?: string; blocks?: string[] };
        if (parsed?.style && parsed?.blocks?.length) {
          selectedStyle = parsed.style;
          selectedBlocks = parsed.blocks;
        }
      } catch {
        // ignore malformed storage
      }
    } else {
      const lastStyle = window.localStorage.getItem("workoutBuilderLastStyle");
      if (lastStyle) {
        selectedStyle = lastStyle;
        selectedBlocks = styleBlocksMap[lastStyle] ?? blockTemplates;
      }
    }

    const styleDraftKey = `workoutBuilderDraft:${selectedStyle}`;
    const storedDraft = window.localStorage.getItem(styleDraftKey);
    if (storedDraft) {
      try {
        const parsed = JSON.parse(storedDraft) as WorkoutBuilderDraft;
        const normalizedDraftBlocks = normalizeWorkoutBlocks(parsed?.blocks);
        if (
          normalizedDraftBlocks.length > 0 &&
          blocksMatchStyle(normalizedDraftBlocks, selectedBlocks)
        ) {
          setSessionName(parsed.sessionName ?? "Custom Session");
          setTrainingStyle(parsed.trainingStyle ?? selectedStyle);
          setTemplatePoolIds(parsed.templatePoolIds ?? []);
          setBlocks(normalizedDraftBlocks);
          setActiveBlockId(
            parsed.activeBlockId ?? normalizedDraftBlocks[0]?.id ?? initialBlocks[0].id
          );
          setActiveGroupByBlock(
            normalizeActiveGroupByBlock(normalizedDraftBlocks, parsed.activeGroupByBlock)
          );
          setCollapsedBlocks(
            normalizeCollapsedBlocks(normalizedDraftBlocks, parsed.collapsedBlocks)
          );
        } else {
          setTrainingStyle(selectedStyle);
          const nextBlocks = createBlocksFromTitles(selectedBlocks);
          setBlocks(nextBlocks);
          setActiveBlockId(nextBlocks[0]?.id ?? initialBlocks[0].id);
          setActiveGroupByBlock(
            Object.fromEntries(nextBlocks.map((block) => [block.id, block.groups[0].id]))
          );
          setCollapsedBlocks(Object.fromEntries(nextBlocks.map((block) => [block.id, false])));
        }
      } catch {
        // ignore malformed storage
      }
    } else {
      setTrainingStyle(selectedStyle);
      const nextBlocks = createBlocksFromTitles(selectedBlocks);
      setBlocks(nextBlocks);
      setActiveBlockId(nextBlocks[0]?.id ?? initialBlocks[0].id);
      setActiveGroupByBlock(
        Object.fromEntries(nextBlocks.map((block) => [block.id, block.groups[0].id]))
      );
      setCollapsedBlocks(Object.fromEntries(nextBlocks.map((block) => [block.id, false])));
    }
    const storedCart = window.localStorage.getItem("workoutCart");
    if (storedCart) {
      try {
        const parsed = JSON.parse(storedCart) as string[];
        if (Array.isArray(parsed)) {
          setCartIds(parsed);
        }
      } catch {
        // ignore malformed storage
      }
    }

    const storedTemplates = window.localStorage.getItem("workoutTemplates");
    if (storedTemplates) {
      try {
        const parsed = JSON.parse(storedTemplates) as WorkoutTemplate[];
        if (Array.isArray(parsed)) {
          const normalizedTemplates = parsed.map((template, templateIndex) => {
            const safeId =
              typeof template?.id === "string" && template.id.trim()
                ? template.id
                : `template-${templateIndex}`;
            const safeName =
              typeof template?.name === "string" && template.name.trim()
                ? template.name
                : `Template ${templateIndex + 1}`;
            return {
              ...template,
              id: safeId,
              name: safeName,
              blocks: template?.blocks
                ? normalizeWorkoutBlocks(template.blocks).map((block) => ({
                    id: block.id,
                    title: block.title,
                    groups: block.groups
                  }))
                : template?.blocks
            } as WorkoutTemplate;
          });
          setTemplates(normalizedTemplates);
        }
      } catch {
        // ignore malformed storage
      }
    }

    const applyId = window.localStorage.getItem("workoutApplyTemplateId");
    if (applyId) {
      const stored = window.localStorage.getItem("workoutTemplates");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as WorkoutTemplate[];
          const match = Array.isArray(parsed)
            ? parsed.find((template) => template.id === applyId)
            : undefined;
          if (match) {
            applyTemplate(match);
          }
        } catch {
          // ignore malformed storage
        }
      }
      window.localStorage.removeItem("workoutApplyTemplateId");
    }

    const applyBackendIdRaw = window.localStorage.getItem("workoutApplyTemplateBackendId");
    if (applyBackendIdRaw) {
      const applyBackendId = Number(applyBackendIdRaw);
      if (Number.isFinite(applyBackendId) && applyBackendId > 0) {
        fetchWorkoutTemplateDetail(applyBackendId)
          .then((detail) => {
            setTemplatePoolIds(detail.exercises.map((item) => String(item.exerciseId)));
            setTemplateName(detail.templateName);
          })
          .catch(() => {
            // ignore backend apply failure
          })
          .finally(() => {
            window.localStorage.removeItem("workoutApplyTemplateBackendId");
          });
      } else {
        window.localStorage.removeItem("workoutApplyTemplateBackendId");
      }
    }

    const applySessionIdRaw = window.localStorage.getItem("workoutApplySessionId");
    if (applySessionIdRaw) {
      const applySessionId = Number(applySessionIdRaw);
      if (Number.isFinite(applySessionId) && applySessionId > 0) {
        getWorkoutSession(applySessionId)
          .then((remoteSession) => {
            const hydrated = hydrateBuilderStateFromRemoteSession(remoteSession);
            setSessionName(hydrated.sessionName);
            setTrainingStyle(hydrated.trainingStyle);
            setTemplatePoolIds(hydrated.templatePoolIds);
            setBlocks(hydrated.blocks);
            setActiveBlockId(hydrated.activeBlockId);
            setActiveGroupByBlock(hydrated.activeGroupByBlock);
            setCollapsedBlocks(hydrated.collapsedBlocks);
            window.localStorage.setItem("workoutBuilderLastStyle", hydrated.trainingStyle);
            window.localStorage.setItem(
              "workoutStyleSelection",
              JSON.stringify({
                style: hydrated.trainingStyle,
                blocks: hydrated.blocks.map((block) => block.title)
              })
            );
          })
          .catch((error) => {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to load applied workout session.";
            setStartSessionError(message);
          })
          .finally(() => {
            window.localStorage.removeItem("workoutApplySessionId");
          });
      } else {
        window.localStorage.removeItem("workoutApplySessionId");
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadExerciseCatalog = async () => {
      try {
        const remote = await fetchExerciseList({ page: 1, pageSize: 2000 });
        if (cancelled) return;
        setExerciseCatalog((prev) => {
          const merged = new Map<string, ExerciseCatalogEntry>();
          prev.forEach((item) => {
            merged.set(item.id, item);
          });
          remote.list.forEach((item) => {
            const id = String(item.id);
            if (!id) return;
            const existing = merged.get(id);
            merged.set(id, {
              id,
              name: item.name?.trim() || existing?.name || `Exercise #${id}`,
              imageUrl: item.imageUrl || existing?.imageUrl || ""
            });
          });
          return [...merged.values()];
        });
      } catch {
        // keep fallback catalog if remote list is temporarily unavailable
      }
    };
    void loadExerciseCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("workoutTemplates", JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("workoutCart", JSON.stringify(cartIds));
  }, [cartIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: WorkoutBuilderDraft = {
      sessionName,
      trainingStyle,
      templatePoolIds,
      blocks,
      activeBlockId,
      activeGroupByBlock,
      collapsedBlocks
    };
    const styleDraftKey = `workoutBuilderDraft:${trainingStyle}`;
    window.localStorage.setItem(styleDraftKey, JSON.stringify(payload));
    window.localStorage.setItem("workoutBuilderLastStyle", trainingStyle);
  }, [
    sessionName,
    trainingStyle,
    templatePoolIds,
    blocks,
    activeBlockId,
    activeGroupByBlock,
    collapsedBlocks
  ]);

  const exerciseMap = useMemo(() => {
    return new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]));
  }, [exerciseCatalog]);

  const cartExercises = useMemo<CartExercise[]>(() => {
    return cartIds
      .map((id) => {
        const meta = exerciseMap.get(id);
        return {
          id,
          name: meta?.name || `Exercise #${id}`
        };
      })
      .filter((item) => item.id.trim().length > 0);
  }, [cartIds, exerciseMap]);

  const templateExercises = useMemo<CartExercise[]>(() => {
    return templatePoolIds
      .map((id) => {
        const meta = exerciseMap.get(id);
        return {
          id,
          name: meta?.name || `Exercise #${id}`
        };
      })
      .filter((item) => item.id.trim().length > 0);
  }, [templatePoolIds, exerciseMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = exerciseCatalog
      .map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl
      }))
      .filter((item) => item.id && item.name);
    window.localStorage.setItem("workoutCatalog", JSON.stringify(payload));
  }, [exerciseCatalog]);

  useEffect(() => {
    if (exerciseMap.size <= 0) return;
    setBlocks((prev) => {
      let changed = false;
      const next = prev.map((block) => ({
        ...block,
        groups: block.groups.map((group) => ({
          ...group,
          items: group.items.map((item) => {
            const meta = exerciseMap.get(item.id);
            if (!meta?.name) {
              return item;
            }
            const shouldReplace =
              /^exercise\s*#\d+$/i.test(item.name.trim()) ||
              !areLikelySameExerciseName(item.name, meta.name);
            if (!shouldReplace) {
              return item;
            }
            changed = true;
            return {
              ...item,
              name: meta.name
            };
          })
        }))
      }));
      return changed ? next : prev;
    });
  }, [exerciseMap]);

  const getActiveGroupId = (block: WorkoutBlock) =>
    activeGroupByBlock[block.id] ?? block.groups[0]?.id;

  const setActiveGroup = (blockId: string, groupId: string) => {
    setActiveGroupByBlock((prev) => ({ ...prev, [blockId]: groupId }));
  };

  const addGroup = (blockId?: string) => {
    if (!blockId) return;
    const newGroup = createGroup(blockId);
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId ? { ...block, groups: [...block.groups, newGroup] } : block
      )
    );
    setActiveGroup(blockId, newGroup.id);
    setCollapsedBlocks((prev) => ({ ...prev, [blockId]: false }));
  };

  const addExerciseToGroup = (
    blockId: string,
    groupId: string,
    exercise: CartExercise,
    source: "cart" | "template"
  ) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          groups: block.groups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              items: [
                ...group.items,
                {
                  uid: createUid(exercise.id),
                  id: exercise.id,
                  name: exercise.name,
                  sets: 3,
                  reps: 8,
                  rest: 60,
                  time: 0,
                  rounds: 1,
                  source
                }
              ]
            };
          })
        };
      })
    );
    if (source === "cart") {
      setCartIds((prev) => prev.filter((id) => id !== exercise.id));
    } else {
      setTemplatePoolIds((prev) => prev.filter((id) => id !== exercise.id));
    }
  };

  const updateMethod = (blockId: string, groupId: string, method: string) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              groups: block.groups.map((group) =>
                group.id === groupId ? { ...group, method } : group
              )
            }
          : block
      )
    );
  };

  const updateItem = (
    blockId: string,
    groupId: string,
    uid: string,
    field: keyof Omit<BlockExercise, "uid" | "id" | "name" | "source">,
    value: number
  ) => {
    const nextValue = sanitizeExerciseMetric(field, value);
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          groups: block.groups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              items: group.items.map((item) =>
                item.uid === uid ? { ...item, [field]: nextValue } : item
              )
            };
          })
        };
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCartIds((prev) => prev.filter((item) => item !== id));
  };

  const returnItemToPool = (removed: BlockExercise) => {
    if (removed.source === "cart") {
      setCartIds((prev) => (prev.includes(removed.id) ? prev : [...prev, removed.id]));
    } else {
      setTemplatePoolIds((prev) =>
        prev.includes(removed.id) ? prev : [...prev, removed.id]
      );
    }
  };

  const removeItem = (blockId: string, groupId: string, uid: string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          groups: block.groups.map((group) => {
            if (group.id !== groupId) return group;
            const removed = group.items.find((item) => item.uid === uid);
            if (removed) {
              returnItemToPool(removed);
            }
            return { ...group, items: group.items.filter((item) => item.uid !== uid) };
          })
        };
      })
    );
  };

  const clearBlock = (blockId: string) => {
    setBlocks((prev) => {
      const removed: BlockExercise[] = [];
      const next = prev.map((block) => {
        if (block.id !== blockId) return block;
        block.groups.forEach((group) => removed.push(...group.items));
        return {
          ...block,
          groups: block.groups.map((group) => ({ ...group, items: [] }))
        };
      });
      removed.forEach((item) => returnItemToPool(item));
      return next;
    });
  };

  const removeGroup = (blockId: string, groupId: string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const group = block.groups.find((item) => item.id === groupId);
        if (!group) return block;
        group.items.forEach((item) => returnItemToPool(item));
        const nextGroups = block.groups.filter((item) => item.id !== groupId);
        return {
          ...block,
          groups: nextGroups.length ? nextGroups : [createGroup(`${blockId}-0`)]
        };
      })
    );
  };

  const handleDragStart = (uid: string, blockId: string, groupId: string) => {
    setDraggingUid(uid);
    setDraggingFromBlock(blockId);
    setDraggingFromGroup(groupId);
  };

  const resetDragging = () => {
    setDraggingUid(null);
    setDraggingFromBlock(null);
    setDraggingFromGroup(null);
  };

  const moveDraggedToGroupEnd = (blockId: string, groupId: string) => {
    if (!draggingUid || !draggingFromBlock || !draggingFromGroup) return;
    if (draggingFromBlock === blockId && draggingFromGroup === groupId) return;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId && block.id !== draggingFromBlock) return block;
        return {
          ...block,
          groups: block.groups.map((group) => {
            if (block.id === draggingFromBlock && group.id === draggingFromGroup) {
              return { ...group, items: group.items.filter((item) => item.uid !== draggingUid) };
            }
            if (block.id === blockId && group.id === groupId) {
              const fromBlock = prev.find((b) => b.id === draggingFromBlock);
              const fromGroup = fromBlock?.groups.find((g) => g.id === draggingFromGroup);
              const movingItem = fromGroup?.items.find((item) => item.uid === draggingUid);
              if (!movingItem) return group;
              return { ...group, items: [...group.items, movingItem] };
            }
            return group;
          })
        };
      })
    );
    resetDragging();
  };

  const handleDrop = (blockId: string, groupId: string, targetUid: string) => {
    if (!draggingUid || !draggingFromBlock || !draggingFromGroup) return;
    if (draggingUid === targetUid && draggingFromGroup === groupId) return;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId && block.id !== draggingFromBlock) return block;
        return {
          ...block,
          groups: block.groups.map((group) => {
            if (block.id === draggingFromBlock && group.id === draggingFromGroup) {
              return { ...group, items: group.items.filter((item) => item.uid !== draggingUid) };
            }
            if (block.id === blockId && group.id === groupId) {
              const fromBlock = prev.find((b) => b.id === draggingFromBlock);
              const fromGroup = fromBlock?.groups.find((g) => g.id === draggingFromGroup);
              const movingItem = fromGroup?.items.find((item) => item.uid === draggingUid);
              if (!movingItem) return group;
              const next = [...group.items];
              const toIndex = next.findIndex((item) => item.uid === targetUid);
              if (toIndex === -1) {
                next.push(movingItem);
              } else {
                next.splice(toIndex, 0, movingItem);
              }
              return { ...group, items: next };
            }
            return group;
          })
        };
      })
    );
    resetDragging();
  };

  const handleCartDrag = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    event.dataTransfer.setData("type", "cart");
    event.dataTransfer.setData("id", id);
  };

  const handleTemplateDrag = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    event.dataTransfer.setData("type", "template");
    event.dataTransfer.setData("id", id);
  };

  const handleGroupDrop = (
    event: React.DragEvent<HTMLDivElement>,
    blockId: string,
    groupId: string
  ) => {
    event.preventDefault();
    const dragType = event.dataTransfer.getData("type");
    if (dragType === "cart") {
      const id = event.dataTransfer.getData("id");
      const found = cartExercises.find((exercise) => exercise.id === id);
      if (found) {
        addExerciseToGroup(blockId, groupId, found, "cart");
      }
      return;
    }
    if (dragType === "template") {
      const id = event.dataTransfer.getData("id");
      const found = templateExercises.find((exercise) => exercise.id === id);
      if (found) {
        addExerciseToGroup(blockId, groupId, found, "template");
      }
      return;
    }
    moveDraggedToGroupEnd(blockId, groupId);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const ids = new Set<string>(cartIds);
    blocks.forEach((block) =>
      block.groups.forEach((group) =>
        group.items.forEach((item) => {
          ids.add(item.id);
        })
      )
    );
    const nextTemplate: WorkoutTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      style: trainingStyle,
      exerciseIds: [...ids],
      blocks: cloneBlocksForTemplate(blocks)
    };
    setTemplates((prev) => [nextTemplate, ...prev]);
    setTemplateName("");
  };

  const applyTemplate = (template: WorkoutTemplate) => {
    if (template.style) {
      setTrainingStyle(template.style);
    }
    if (template.blocks?.length) {
      const restoredBlocks = hydrateBlocksFromTemplate(
        template.blocks.map((block, blockIndex) => ({
          id: block.id || `block-${blockIndex}`,
          title: block.title,
          groups:
            block.groups && block.groups.length > 0
              ? block.groups.map((group, groupIndex) => ({
                  id: group.id || `group-${blockIndex}-${groupIndex}`,
                  method: group.method,
                  items: group.items.map((item) => ({ ...item }))
                }))
              : [createGroup(`${blockIndex}-0`)]
        }))
      );
      setBlocks(restoredBlocks);
      const firstBlockId = restoredBlocks[0]?.id ?? activeBlockId;
      setActiveBlockId(firstBlockId);
      setActiveGroupByBlock(
        Object.fromEntries(restoredBlocks.map((block) => [block.id, block.groups[0]?.id ?? ""]))
      );
      setCollapsedBlocks(Object.fromEntries(restoredBlocks.map((block) => [block.id, false])));
    }
    setTemplatePoolIds(collectTemplateExerciseIds(template));
  };

  const activeBlock = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];
  const saveDraft = () => {
    if (typeof window === "undefined") return;
    const payload: WorkoutBuilderDraft = {
      sessionName,
      trainingStyle,
      templatePoolIds,
      blocks,
      activeBlockId,
      activeGroupByBlock,
      collapsedBlocks
    };
    const styleDraftKey = `workoutBuilderDraft:${trainingStyle}`;
    window.localStorage.setItem(styleDraftKey, JSON.stringify(payload));
    window.localStorage.setItem("workoutBuilderLastStyle", trainingStyle);
  };

  const handleStartSession = async () => {
    if (isStartingSession) return;

    setStartSessionError(null);
    setIsStartingSession(true);

    try {
      saveDraft();

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("quickModuleActive");
      }

      const userId = readStoredUserId();
      const safeSessionName = sessionName.trim() || "Custom Session";
      const createdSession = await createWorkoutSession({
        userId,
        sessionName: safeSessionName,
        trainingStyle,
        blockNames: blocks.map((block) => block.title)
      });

      const remoteSession = await getWorkoutSession(createdSession.id);
      const remoteBlocksByName = new Map(
        remoteSession.blocks.map((block) => [block.blockName.trim().toLowerCase(), block])
      );

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        const localBlock = blocks[blockIndex];
        const remoteBlock =
          remoteBlocksByName.get(localBlock.title.trim().toLowerCase()) ??
          remoteSession.blocks[blockIndex];

        if (!remoteBlock?.id) continue;

        for (let groupIndex = 0; groupIndex < localBlock.groups.length; groupIndex += 1) {
          const localGroup = localBlock.groups[groupIndex];
          const createdGroup = await createWorkoutGroup({
            blockId: remoteBlock.id,
            method: localGroup.method,
            orderIndex: groupIndex + 1
          });

          for (let itemIndex = 0; itemIndex < localGroup.items.length; itemIndex += 1) {
            const item = localGroup.items[itemIndex];
            const exerciseId = toExerciseId(item.id);
            if (!Number.isFinite(exerciseId) || exerciseId <= 0) continue;

            await createWorkoutExercise({
              groupId: createdGroup.id,
              exerciseId,
              sets: item.sets,
              reps: item.reps,
              restSeconds: item.rest,
              timeSeconds: item.time,
              rounds: item.rounds,
              orderIndex: itemIndex + 1
            });
          }
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("workoutActiveSessionId", String(createdSession.id));
        window.localStorage.setItem("workoutActiveUserId", String(userId));
        window.localStorage.removeItem("workoutActiveRunId");
        window.localStorage.removeItem("workoutActiveRunSessionId");
      }

      navigate(`/workout?sessionId=${createdSession.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start workout session.";
      setStartSessionError(message);
    } finally {
      setIsStartingSession(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 selection:bg-emerald-400/20">
      <header className="fixed top-0 z-[100] flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#07090d]/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-2xl font-black uppercase tracking-tight text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            Somatic Building
          </Link>
          <div className="hidden h-4 w-px bg-white/10 md:block" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 md:block">
            Training Composer
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/library"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/[0.08]"
          >
            Add From Library
          </Link>
          <button
            type="button"
            onClick={saveDraft}
            className="rounded-full bg-emerald-400 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-emerald-300"
          >
            Save Arrangement
          </button>
          <button
            type="button"
            onClick={handleStartSession}
            disabled={isStartingSession}
            className="rounded-full bg-emerald-400 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isStartingSession ? "Starting..." : "Start Workout"}
          </button>
        </div>
      </header>

      <main className="mx-auto min-h-screen max-w-7xl px-6 pb-16 pt-24">
        <section className="mb-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Somatic Building
            </p>
            <h1 className="text-4xl font-black uppercase tracking-tight text-white">
              Training_Composer
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Arrange your session blocks and drop exercises from the cart or templates into each
              training phase.
            </p>
          </div>
          <button
            type="button"
            onClick={saveDraft}
            className="rounded-full bg-emerald-400 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:shadow-[0_0_20px_rgba(78,222,163,0.35)]"
          >
            Save Arrangement
          </button>
        </section>

        {startSessionError && (
          <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Start failed: {startSessionError}
          </div>
        )}

        <section className="mb-8 grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Session Name
            </label>
            <Input
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              className="border-white/10 bg-black/40 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Training Style
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                Selected
              </span>
              <span className="text-sm text-white">{trainingStyle}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Save Course Arrangement
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Course Name"
                className="border-white/10 bg-black/40 text-white"
              />
              <button
                type="button"
                onClick={saveTemplate}
                disabled={!templateName.trim()}
                className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  templateName.trim()
                    ? "bg-emerald-400 text-black hover:bg-emerald-300"
                    : "bg-white/10 text-zinc-400"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_2.4fr]">
          <aside className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  Exercise Cart
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {cartExercises.length}
                </span>
              </div>
              <div className="space-y-3 p-4">
                {cartExercises.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
                    Your cart is empty. Add exercises from the library to start building.
                  </div>
                ) : (
                  cartExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      draggable
                      onDragStart={(event) => handleCartDrag(event, exercise.id)}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-zinc-500" />
                        <span>{exercise.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(exercise.id)}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
                <Link
                  to="/library"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-emerald-300"
                >
                  <Dumbbell className="h-4 w-4" />
                  Exercise Library
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  Templates
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {templates.length}
                </span>
              </div>
              <div className="space-y-3 p-4">
                {templates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
                    Save templates from the library or here to build a custom pool.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white transition hover:border-emerald-400/40"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{template.name}</p>
                          {template.style && (
                            <p className="text-xs text-zinc-500">{template.style}</p>
                          )}
                        </div>
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                )}
                <Link
                  to="/templates"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/[0.08]"
                >
                  <Layers className="h-4 w-4" />
                  Template Library
                </Link>
              </div>
            </div>
          </aside>
          <div className="min-w-0 space-y-6">
            <div className="w-full max-w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
                    Template Exercises
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                    Drag these into blocks without overwriting structure
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {templateExercises.length} staged
                </span>
              </div>
              <div className="mt-4">
                {templateExercises.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
                    Choose a template to stage exercises here.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {templateExercises.map((exercise) => (
                      <div
                        key={exercise.id}
                        draggable
                        onDragStart={(event) => handleTemplateDrag(event, exercise.id)}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-zinc-500" />
                          <span>{exercise.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">
                Workout_Structure
              </h2>
              <p className="text-xs text-zinc-500">
                Blocks flow left to right. Active block expands for detail.
              </p>
            </div>

            <div className="relative max-w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#07090d] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#07090d] to-transparent" />
              <div
                ref={blockScrollRef}
                className="flex max-w-full gap-6 overflow-x-auto pb-6 pt-2"
              >
                {blocks.map((block) => {
                  const isActive = block.id === activeBlockId;
                  const isCollapsed = collapsedBlocks[block.id];
                  return (
                    <div
                      key={block.id}
                      className={`flex-none rounded-2xl border transition ${
                        isActive
                          ? "h-[640px] w-[320px] border-emerald-400/40 bg-black/60 shadow-[0_0_40px_rgba(78,222,163,0.15)]"
                          : "h-[520px] w-[240px] border-white/10 bg-black/40 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div
                        className="cursor-pointer space-y-4 p-6"
                        onClick={() => {
                          setActiveBlockId(block.id);
                          setCollapsedBlocks((prev) => ({ ...prev, [block.id]: false }));
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="inline-block rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                              <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-500">
                                Phase
                              </p>
                              <h3 className="text-base font-semibold uppercase text-white">
                                {block.title}
                              </h3>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCollapsedBlocks((prev) => ({
                                ...prev,
                                [block.id]: !prev[block.id]
                              }));
                            }}
                            className="rounded-full border border-white/10 bg-white/5 p-1 text-zinc-300"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 font-semibold uppercase text-emerald-200">
                            {block.groups.length} groups
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                addGroup(block.id);
                              }}
                              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-tight text-zinc-400 hover:text-emerald-300"
                            >
                              <Plus className="h-3 w-3" />
                              Group
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                clearBlock(block.id);
                              }}
                              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-tight text-rose-300 hover:text-rose-200"
                            >
                              <Trash2 className="h-3 w-3" />
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <div className="flex h-[calc(100%-112px)] flex-col space-y-4 overflow-y-auto px-6 pb-6 pt-4">
                          {block.groups.map((group) => {
                            const isGroupActive = getActiveGroupId(block) === group.id;
                            return (
                              <div
                                key={group.id}
                                className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition ${
                                  isGroupActive ? "ring-1 ring-emerald-400/40" : ""
                                }`}
                                onClick={() => {
                                  setActiveBlockId(block.id);
                                  setActiveGroup(block.id, group.id);
                                }}
                                onDrop={(event) => handleGroupDrop(event, block.id, group.id)}
                                onDragOver={(event) => event.preventDefault()}
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                    Training Method
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                      {group.items.length} items
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeGroup(block.id, group.id)}
                                      className="rounded-full border border-rose-400/40 bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-100 hover:bg-rose-400/30"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {groupMethods.map((method) => (
                                    <button
                                      key={method}
                                      type="button"
                                      onClick={() => updateMethod(block.id, group.id, method)}
                                      className={`rounded-full border px-2 py-1 text-[10px] transition ${
                                        group.method === method
                                          ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-100"
                                          : "border-white/10 bg-white/5 text-zinc-300"
                                      }`}
                                    >
                                      {method}
                                    </button>
                                  ))}
                                </div>
                                <div className="my-3 h-px w-full bg-white/10" />
                                <div className="space-y-3">
                                  {group.items.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-3 text-xs text-zinc-400">
                                      Drop exercises here to build a {group.method.toLowerCase()}{" "}
                                      group.
                                    </div>
                                  )}
                                  {group.items.map((item) => {
                                    const exercise = exerciseMap.get(item.id);
                                    return (
                                      <div
                                        key={item.uid}
                                        draggable
                                        onDragStart={() =>
                                          handleDragStart(item.uid, block.id, group.id)
                                        }
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          handleDrop(block.id, group.id, item.uid);
                                        }}
                                        onDragOver={(event) => event.preventDefault()}
                                        className="rounded-xl border border-white/10 bg-black/60 p-3"
                                      >
                                        <div className="space-y-3">
                                          <Link
                                            to={`/exercise/${item.id}`}
                                            className="relative block w-full overflow-hidden rounded-lg border border-white/10"
                                          >
                                            {exercise?.imageUrl ? (
                                              <>
                                                <div
                                                  className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
                                                  style={{ backgroundImage: `url(${exercise.imageUrl})` }}
                                                />
                                                <div className="absolute inset-0 bg-black/25" />
                                                <img
                                                  src={exercise.imageUrl}
                                                  alt={item.name}
                                                  className="relative z-10 h-auto w-full object-contain"
                                                />
                                              </>
                                            ) : (
                                              <div className="flex h-28 w-full items-center justify-center bg-white/5 text-xs text-zinc-400">
                                                No image
                                              </div>
                                            )}
                                          </Link>
                                          <div className="flex items-start justify-between">
                                            <div>
                                              <Link
                                                to={`/exercise/${item.id}`}
                                                className="text-sm font-semibold uppercase text-white hover:text-emerald-200"
                                              >
                                                {item.name}
                                              </Link>
                                              <p className="text-[10px] text-zinc-500 uppercase">
                                                {item.source === "cart"
                                                  ? "From cart"
                                                  : "From template"}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] uppercase">
                                              <Link
                                                to={`/exercise/${item.id}`}
                                                className="text-zinc-400 hover:text-white"
                                              >
                                                Details
                                              </Link>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeItem(block.id, group.id, item.uid)
                                                }
                                                className="text-zinc-400 hover:text-white"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-[repeat(5,minmax(46px,1fr))] gap-1.5 text-[10px] text-zinc-300">
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-[8px] uppercase text-zinc-500">
                                                Sets
                                              </span>
                                              <Input
                                                type="number"
                                                value={sanitizeExerciseMetric("sets", item.sets)}
                                                onChange={(event) =>
                                                  updateItem(
                                                    block.id,
                                                    group.id,
                                                    item.uid,
                                                    "sets",
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="h-7 w-full min-w-[46px] border-white/10 bg-white/5 px-0 text-center font-mono text-[11px] leading-none tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-[8px] uppercase text-zinc-500">
                                                Reps
                                              </span>
                                              <Input
                                                type="number"
                                                value={sanitizeExerciseMetric("reps", item.reps)}
                                                onChange={(event) =>
                                                  updateItem(
                                                    block.id,
                                                    group.id,
                                                    item.uid,
                                                    "reps",
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="h-7 w-full min-w-[46px] border-white/10 bg-white/5 px-0 text-center font-mono text-[11px] leading-none tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-[8px] uppercase text-zinc-500">
                                                Rest
                                              </span>
                                              <Input
                                                type="number"
                                                value={sanitizeExerciseMetric("rest", item.rest)}
                                                onChange={(event) =>
                                                  updateItem(
                                                    block.id,
                                                    group.id,
                                                    item.uid,
                                                    "rest",
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="h-7 w-full min-w-[46px] border-white/10 bg-white/5 px-0 text-center font-mono text-[11px] leading-none tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-[8px] uppercase text-zinc-500">
                                                Time
                                              </span>
                                              <Input
                                                type="number"
                                                value={sanitizeExerciseMetric("time", item.time)}
                                                onChange={(event) =>
                                                  updateItem(
                                                    block.id,
                                                    group.id,
                                                    item.uid,
                                                    "time",
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="h-7 w-full min-w-[46px] border-white/10 bg-white/5 px-0 text-center font-mono text-[11px] leading-none tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                              />
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="text-[8px] uppercase text-zinc-500">
                                                Rnd
                                              </span>
                                              <Input
                                                type="number"
                                                value={sanitizeExerciseMetric("rounds", item.rounds)}
                                                onChange={(event) =>
                                                  updateItem(
                                                    block.id,
                                                    group.id,
                                                    item.uid,
                                                    "rounds",
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="h-7 w-full min-w-[46px] border-white/10 bg-white/5 px-0 text-center font-mono text-[11px] leading-none tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Active Block Details
              </p>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">
                {activeBlock?.title ? `PHASE: ${activeBlock.title}` : "PHASE"}
              </h2>
              <p className="text-xs uppercase text-zinc-500">
                {activeBlock?.groups.length ?? 0} training groups
              </p>
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={handleStartSession}
        disabled={isStartingSession}
        className="fixed bottom-8 right-8 z-50 flex items-center gap-4 rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-black shadow-[0_10px_40px_rgba(78,222,163,0.3)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isStartingSession ? "Starting..." : "Start_Session"}
      </button>
    </div>
  );
}
