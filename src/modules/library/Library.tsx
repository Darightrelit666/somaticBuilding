import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router';
import { exercises as localExercises } from '../../shared/data/exercises';
import { systems } from '../../shared/data/systems';
import { ImageWithFallback } from '../../shared/components/figma/ImageWithFallback';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui/card';
import { Button } from '../../shared/components/ui/button';
import { Badge } from '../../shared/components/ui/badge';
import { Separator } from '../../shared/components/ui/separator';
import { Input } from '../../shared/components/ui/input';
import {
  createCustomExercise,
  fetchExerciseTags,
  fetchExerciseList,
  uploadExerciseMedia,
  type ExerciseTagData,
  type ExerciseCardData
} from '../../shared/api/exercises';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  Dumbbell,
  Flame,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  User
} from 'lucide-react';

type FiltersState = {
  category: string;
  ability: string;
  equipment: string;
  difficulty: string;
};

type FiltersOptions = {
  category: string[];
  ability: string[];
  equipment: string[];
  difficulty: string[];
};

const REMOTE_PAGE_SIZE = 24;

const SYSTEM_CATEGORY_TAG_NAMES: Record<string, string[]> = {
  strength: ["Strength", "Powerlifting", "Olympic Weightlifting", "Strongman"],
  cardio: ["Cardio"],
  stretching: ["Stretching"],
  yoga: ["Stretching"],
  crossfit: ["Plyometrics", "Strength", "Cardio"],
  "animal-flow": ["Stretching", "Cardio"],
  "street-workout": ["Strength", "Plyometrics"]
};

const matchSystemInLocalFallback = (exercise: ExerciseCardData, systemId?: string) => {
  if (!systemId) return true;

  const movement = exercise.movementPattern.toLowerCase();
  const equipment = exercise.equipmentTag.toLowerCase();
  const difficulty = exercise.difficulty.toLowerCase();
  const ability = exercise.abilityTag.toLowerCase();

  if (systemId === "strength") {
    return ["barbell", "dumbbell", "machine", "cable", "kettlebell"].includes(equipment);
  }
  if (systemId === "cardio") {
    return (
      movement.includes("cardio") ||
      movement.includes("conditioning") ||
      movement.includes("endurance")
    );
  }
  if (systemId === "stretching" || systemId === "yoga") {
    return (
      movement.includes("stretch") ||
      movement.includes("mobility") ||
      movement.includes("flow") ||
      movement.includes("yoga")
    );
  }
  if (systemId === "crossfit") {
    return (
      movement.includes("clean") ||
      movement.includes("snatch") ||
      movement.includes("thruster") ||
      movement.includes("burpee") ||
      movement.includes("conditioning") ||
      equipment === "kettlebell" ||
      (equipment === "barbell" && (difficulty === "hard" || ability === "advanced"))
    );
  }
  if (systemId === "animal-flow" || systemId === "street-workout") {
    return equipment === "bodyweight";
  }
  return true;
};

type CustomExerciseFormState = {
  name: string;
  primaryMuscle: string;
  equipment: string;
  difficulty: "1" | "2" | "3";
  description: string;
};

const DEFAULT_CUSTOM_EXERCISE_FORM: CustomExerciseFormState = {
  name: "",
  primaryMuscle: "",
  equipment: "",
  difficulty: "2",
  description: ""
};

function Header({
  searchValue,
  onSearchChange
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isLibrary = location.pathname.includes('/library');
  const handleBack = () => {
    const locationState = location.state as { returnTo?: string } | null;
    if (locationState?.returnTo) {
      navigate(locationState.returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/training');
  };

  return (
    <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          {isLibrary && (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-emerald-400 cursor-pointer hidden sm:flex"
          >
            <Dumbbell className="w-7 h-7" />
            <span className="font-black text-xl tracking-tight">Somatic Building</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search exercises, movements, or equipment..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 hover:border-zinc-700 transition-all shadow-inner shadow-black/20"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button className="p-2.5 text-zinc-400 hover:text-zinc-100 rounded-full hover:bg-zinc-800 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-zinc-950"></span>
          </button>
          <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-zinc-300 hover:border-emerald-400 transition-colors overflow-hidden shrink-0">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Filters({
  title = "Exercise Library",
  totalCount = 0,
  showSystemSelector = false,
  activeSystemId,
  onSystemChange,
  filters,
  options,
  onChange
}: {
  title?: string;
  totalCount?: number;
  showSystemSelector?: boolean;
  activeSystemId?: string;
  onSystemChange?: (nextSystemId: string) => void;
  filters: FiltersState;
  options: FiltersOptions;
  onChange: (next: FiltersState) => void;
}) {
  return (
    <div className="py-6 border-b border-zinc-800/50 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-end gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight uppercase">
              {title}
            </h1>
            <span className="px-2.5 py-0.5 mb-1 rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400">
              {totalCount}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button className="p-1.5 rounded-md bg-zinc-800 text-zinc-100 shadow-sm">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showSystemSelector && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Style
            </span>
            {[{ id: "all", name: "All Exercises" }, ...systems.map((system) => ({
              id: system.id,
              name: system.name
            }))].map((system) => {
              const isActive = (activeSystemId ?? "all") === system.id;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => onSystemChange?.(system.id)}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    isActive
                      ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  ].join(" ")}
                >
                  {system.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-semibold transition-colors shrink-0 shadow-sm">
            Filters
          </button>

          <div className="w-px h-6 bg-zinc-800 mx-2 shrink-0"></div>

          {[
            { key: "category", label: "Category", values: options.category },
            { key: "ability", label: "Ability", values: options.ability },
            { key: "equipment", label: "Equipment", values: options.equipment },
            { key: "difficulty", label: "Difficulty", values: options.difficulty }
          ].map((filter) => (
            <div
              key={filter.key}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm border border-zinc-800 hover:border-zinc-700 transition-all shrink-0 group"
            >
              <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">
                {filter.label}:
              </span>
              <div className="relative">
                <select
                  value={filters[filter.key as keyof FiltersState]}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      [filter.key]: event.target.value
                    })
                  }
                  className="appearance-none bg-transparent pr-5 font-medium text-zinc-200 focus:outline-none"
                >
                  {["Any", ...filter.values].map((value) => (
                    <option key={value} value={value} className="bg-zinc-900 text-zinc-100">
                      {value}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  isSelected = false,
  onToggleSelect
}: {
  exercise: ExerciseCardData;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Medium':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Hard':
        return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <div
      className={[
        "group flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1",
        isSelected ? "border-emerald-400/70 bg-emerald-400/5" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      ].join(" ")}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-800">
        <ImageWithFallback
          src={exercise.imageUrl}
          alt={exercise.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent"></div>

        <div className="absolute top-3 right-3">
          <span
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border backdrop-blur-md shadow-sm ${getDifficultyColor(
              exercise.difficulty
            )}`}
          >
            <Flame className="w-3.5 h-3.5" />
            {exercise.difficulty}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onToggleSelect?.(exercise.id)}
          className={[
            "absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
            isSelected
              ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200"
              : "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-emerald-400/60 hover:text-emerald-200"
          ].join(" ")}
        >
          {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isSelected ? "Added" : "Add"}
        </button>
      </div>

      <div className="flex flex-col flex-1 p-5 gap-4 bg-zinc-900 relative">
        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-bold text-zinc-100 leading-tight group-hover:text-emerald-400 transition-colors line-clamp-2">
            {exercise.name}
          </h3>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
              <Activity className="w-3 h-3" />
              {exercise.movementPattern}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              {exercise.abilityTag}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wider">
              <Settings2 className="w-3 h-3" />
              {exercise.equipmentTag}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-zinc-800/60">
          <Link
            to={`/exercise/${exercise.id}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-zinc-800 hover:bg-emerald-400 text-zinc-300 hover:text-zinc-950 font-bold text-sm transition-all duration-300 border border-zinc-700 hover:border-emerald-400 shadow-sm"
          >
            <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Library() {
  const navigate = useNavigate();
  const { systemId } = useParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState<string>("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [exercisePool, setExercisePool] = useState<ExerciseCardData[]>(localExercises);
  const [exerciseCache, setExerciseCache] = useState<Record<string, ExerciseCardData>>(
    () => Object.fromEntries(localExercises.map((exercise) => [exercise.id, exercise]))
  );
  const [dataSource, setDataSource] = useState<"local" | "remote">("local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [remoteTotal, setRemoteTotal] = useState(localExercises.length);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingCustomExercise, setIsCreatingCustomExercise] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [categoryTagIdMap, setCategoryTagIdMap] = useState<Record<string, number>>({});
  const [hasLoadedTagCatalog, setHasLoadedTagCatalog] = useState(false);
  const [isTagCatalogAvailable, setIsTagCatalogAvailable] = useState(false);
  const [customForm, setCustomForm] = useState<CustomExerciseFormState>(
    DEFAULT_CUSTOM_EXERCISE_FORM
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [filters, setFilters] = useState({
    category: "Any",
    ability: "Any",
    equipment: "Any",
    difficulty: "Any"
  });
  
  // Find current system name to pass to Filters, fallback to generic
  const currentSystem = systems.find((s) => s.id === systemId);
  const title = currentSystem ? `${currentSystem.name} Library` : "All Exercises";
  const systemTagIds = useMemo(() => {
    if (!systemId) return [] as number[];
    const mappedNames = SYSTEM_CATEGORY_TAG_NAMES[systemId] ?? [];
    return mappedNames
      .map((name) => categoryTagIdMap[name.toLowerCase()])
      .filter((id): id is number => Number.isFinite(id) && id > 0);
  }, [categoryTagIdMap, systemId]);
  const waitingSystemTagCatalog = Boolean(systemId) && !hasLoadedTagCatalog;
  const normalizedKeyword = debouncedKeyword.trim().toLowerCase();
  const selectedExercises = useMemo(
    () =>
      selectedIds
        .map((id) => exerciseCache[id])
        .filter((exercise): exercise is ExerciseCardData => Boolean(exercise)),
    [exerciseCache, selectedIds]
  );

  const openCreatePanel = () => {
    setCreateError(null);
    setCreateSuccess(null);
    setCustomForm(DEFAULT_CUSTOM_EXERCISE_FORM);
    setCoverFile(null);
    setVideoFile(null);
    setIsCreateOpen(true);
  };

  const handleSystemChange = (nextSystemId: string) => {
    const normalizedNext = nextSystemId === "all" ? undefined : nextSystemId;
    const normalizedCurrent = systemId ?? undefined;
    if (normalizedNext === normalizedCurrent) return;

    setCurrentPage(1);
    if (normalizedNext) {
      navigate(`/library/${normalizedNext}`);
      return;
    }
    navigate("/library");
  };

  const closeCreatePanel = () => {
    if (isCreatingCustomExercise || isUploadingMedia) return;
    setIsCreateOpen(false);
    setCreateError(null);
    setCustomForm(DEFAULT_CUSTOM_EXERCISE_FORM);
    setCoverFile(null);
    setVideoFile(null);
  };

  const filterOptions = useMemo(() => {
    const unique = (items: string[]) =>
      Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      category: unique(exercisePool.map((ex) => ex.movementPattern)),
      ability: unique(exercisePool.map((ex) => ex.abilityTag)),
      equipment: unique(exercisePool.map((ex) => ex.equipmentTag)),
      difficulty: unique(exercisePool.map((ex) => ex.difficulty))
    };
  }, [exercisePool]);

  const filteredExercises = useMemo(() => {
    return exercisePool.filter((exercise) => {
      if (dataSource === "local" && !matchSystemInLocalFallback(exercise, systemId)) {
        return false;
      }
      if (
        normalizedKeyword &&
        ![
          exercise.name,
          exercise.movementPattern,
          exercise.equipmentTag,
          exercise.abilityTag
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)
      ) {
        return false;
      }
      if (filters.category !== "Any" && exercise.movementPattern !== filters.category) {
        return false;
      }
      if (filters.ability !== "Any" && exercise.abilityTag !== filters.ability) {
        return false;
      }
      if (filters.equipment !== "Any" && exercise.equipmentTag !== filters.equipment) {
        return false;
      }
      if (filters.difficulty !== "Any" && exercise.difficulty !== filters.difficulty) {
        return false;
      }
      return true;
    });
  }, [exercisePool, filters, normalizedKeyword, dataSource, systemId]);

  const remoteTotalPages = useMemo(
    () => Math.max(1, Math.ceil(remoteTotal / REMOTE_PAGE_SIZE)),
    [remoteTotal]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedKeyword(searchValue.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  useEffect(() => {
    let cancelled = false;
    const loadTagCatalog = async () => {
      try {
        const tags = await fetchExerciseTags();
        if (cancelled) return;
        const categoryMap: Record<string, number> = {};
        tags
          .filter((tag: ExerciseTagData) => tag.tagType.toLowerCase() === "category")
          .forEach((tag: ExerciseTagData) => {
            categoryMap[tag.tagName.toLowerCase()] = tag.id;
          });
        setCategoryTagIdMap(categoryMap);
        setIsTagCatalogAvailable(Object.keys(categoryMap).length > 0);
      } catch {
        if (cancelled) return;
        setCategoryTagIdMap({});
        setIsTagCatalogAvailable(false);
      } finally {
        if (!cancelled) {
          setHasLoadedTagCatalog(true);
        }
      }
    };

    void loadTagCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [systemId]);

  useEffect(() => {
    setExerciseCache((prev) => {
      const next = { ...prev };
      for (const exercise of exercisePool) {
        next[exercise.id] = exercise;
      }
      return next;
    });
  }, [exercisePool]);

  useEffect(() => {
    if (dataSource !== "remote") return;
    if (currentPage <= remoteTotalPages) return;
    setCurrentPage(remoteTotalPages);
  }, [currentPage, dataSource, remoteTotalPages]);

  useEffect(() => {
    if (waitingSystemTagCatalog) return;
    if (systemId && isTagCatalogAvailable && systemTagIds.length === 0) {
      setExercisePool([]);
      setRemoteTotal(0);
      setDataSource("remote");
      setSyncError(null);
      setIsLoadingRemote(false);
      return;
    }

    let cancelled = false;
    const loadRemoteExercises = async () => {
      try {
        setIsLoadingRemote(true);
        const response = await fetchExerciseList({
          keyword: debouncedKeyword || undefined,
          tagIds: systemId && isTagCatalogAvailable ? systemTagIds : undefined,
          page: currentPage,
          pageSize: REMOTE_PAGE_SIZE
        });
        if (cancelled) return;

        setExercisePool(response.list);
        setRemoteTotal(response.total);
        setDataSource("remote");
        setSyncError(null);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Exercise API load failed.";
        setExercisePool(localExercises);
        setRemoteTotal(localExercises.length);
        setDataSource("local");
        setSyncError(message);
      } finally {
        if (!cancelled) {
          setIsLoadingRemote(false);
        }
      }
    };
    void loadRemoteExercises();
    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    debouncedKeyword,
    reloadNonce,
    systemId,
    systemTagIds,
    waitingSystemTagCatalog,
    isTagCatalogAvailable
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("workoutCart");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setSelectedIds(parsed);
        }
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("workoutTemplates");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as any[];
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
        }
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("workoutCart", JSON.stringify(selectedIds));
  }, [selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    ));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const saveTemplate = () => {
    if (!templateName.trim() || selectedIds.length === 0) return;
    const payload = {
      id: `tpl-${Date.now()}`,
      name: templateName.trim(),
      style: "Strength & Conditioning",
      cartIds: selectedIds,
      blocks: []
    };
    const next = [payload, ...templates];
    setTemplates(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("workoutTemplates", JSON.stringify(next));
    }
    setTemplateName("");
  };

  const handleCreateCustomExercise = async () => {
    if (isCreatingCustomExercise || isUploadingMedia) return;

    const name = customForm.name.trim();
    const primaryMuscle = customForm.primaryMuscle.trim();
    const equipment = customForm.equipment.trim();
    const description = customForm.description.trim();

    if (name.length < 2) {
      setCreateError("Exercise name must be at least 2 characters.");
      return;
    }
    if (coverFile && !coverFile.type.startsWith("image/")) {
      setCreateError("Cover file must be an image.");
      return;
    }
    if (videoFile && !videoFile.type.startsWith("video/")) {
      setCreateError("Video file must be a video.");
      return;
    }

    setCreateError(null);
    setIsCreatingCustomExercise(true);
    try {
      let coverUrl: string | undefined;
      let videoUrl: string | undefined;

      if (coverFile || videoFile) {
        setIsUploadingMedia(true);
      }
      if (coverFile) {
        const uploadedCover = await uploadExerciseMedia({
          file: coverFile,
          mediaType: "image"
        });
        coverUrl = uploadedCover.url;
      }
      if (videoFile) {
        const uploadedVideo = await uploadExerciseMedia({
          file: videoFile,
          mediaType: "video"
        });
        videoUrl = uploadedVideo.url;
      }

      await createCustomExercise({
        name,
        primaryMuscle: primaryMuscle || undefined,
        equipment: equipment || undefined,
        difficulty: Number(customForm.difficulty),
        description: description || undefined,
        coverUrl,
        videoUrl
      });

      setCreateSuccess(`Custom exercise "${name}" created.`);
      setCustomForm(DEFAULT_CUSTOM_EXERCISE_FORM);
      setCoverFile(null);
      setVideoFile(null);
      setFilters({
        category: "Any",
        ability: "Any",
        equipment: "Any",
        difficulty: "Any"
      });
      setSearchValue("");
      setDebouncedKeyword("");
      setCurrentPage(1);
      setReloadNonce((prev) => prev + 1);
      setIsCreateOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create custom exercise.";
      setCreateSuccess(null);
      setCreateError(message);
    } finally {
      setIsCreatingCustomExercise(false);
      setIsUploadingMedia(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-400/30 selection:text-emerald-950 flex flex-col">
      <Header
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value);
          setCurrentPage(1);
        }}
      />
      
      <main className="flex-1 pb-24">
        <Filters
          title={title}
          totalCount={dataSource === "remote" ? remoteTotal : filteredExercises.length}
          showSystemSelector={!systemId}
          activeSystemId={systemId}
          onSystemChange={handleSystemChange}
          filters={filters}
          options={filterOptions}
          onChange={setFilters}
        />
        <div className="max-w-7xl mx-auto px-4 pt-4 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Data source: {dataSource === "remote" ? "Backend API" : "Local fallback"}
              {dataSource === "remote"
                ? ` · Total ${remoteTotal} · Page ${currentPage}/${remoteTotalPages}`
                : ""}
              {isLoadingRemote ? " · Loading..." : ""}
              {syncError ? ` · ${syncError}` : ""}
            </p>
            <Button
              type="button"
              className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
              onClick={openCreatePanel}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Exercise
            </Button>
          </div>
          {createSuccess && (
            <p className="text-xs text-emerald-300">{createSuccess}</p>
          )}
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExercises.map(exercise => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    isSelected={selectedIds.includes(exercise.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
              {dataSource === "remote" && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    disabled={currentPage <= 1 || isLoadingRemote}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-zinc-400">
                    Page {currentPage} / {remoteTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    disabled={currentPage >= remoteTotalPages || isLoadingRemote}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(remoteTotalPages, prev + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            <aside className="hidden lg:block">
              <Card className="sticky top-6 border-zinc-800 bg-zinc-900/70">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white">Training Cart</CardTitle>
                    <Badge className="bg-emerald-400/20 text-emerald-200">
                      {selectedIds.length} selected
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Build your session by stacking movements like a cart.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Queue
                  </div>
                  <Separator className="bg-zinc-800" />
                  {selectedExercises.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-500">
                      Add exercises from the library to start building a workout.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedExercises.map((exercise) => (
                        <div
                          key={exercise.id}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{exercise.name}</p>
                              <p className="text-xs text-zinc-400">3 sets 路 10 reps</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleSelect(exercise.id)}
                              className="text-zinc-500 hover:text-emerald-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator className="bg-zinc-800" />
                  <div className="space-y-2">
                    <Button
                      asChild
                      className="w-full bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                      disabled={selectedExercises.length === 0}
                    >
                      <Link to="/workout-builder">Start Training</Link>
                    </Button>
                    <Button
                      variant="outline"
                      className={[
                        "w-full border-zinc-700 text-zinc-200 transition-colors",
                        templateName.trim()
                          ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300 border-emerald-400"
                          : "bg-zinc-900 hover:bg-zinc-800"
                      ].join(" ")}
                      disabled={!templateName.trim() || selectedExercises.length === 0}
                      onClick={saveTemplate}
                    >
                      Save as Template
                    </Button>
                    <Input
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Template name"
                      className="h-9 rounded-xl border-zinc-800 bg-zinc-950/60 text-white"
                    />
                    <Button
                      variant="ghost"
                      className="w-full text-zinc-400 hover:text-white"
                      disabled={selectedExercises.length === 0}
                      onClick={clearSelection}
                    >
                      Clear cart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>

        {isCreateOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Create Custom Exercise</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Add your own movement and sync it to the exercise library.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreatePanel}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:border-zinc-500 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Exercise Name</p>
                  <Input
                    value={customForm.name}
                    onChange={(event) =>
                      setCustomForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g. Half-kneeling Cable Lift"
                    className="h-11 rounded-xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Primary Muscle</p>
                  <Input
                    value={customForm.primaryMuscle}
                    onChange={(event) =>
                      setCustomForm((prev) => ({ ...prev, primaryMuscle: event.target.value }))
                    }
                    placeholder="e.g. Core"
                    className="h-11 rounded-xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Equipment</p>
                  <Input
                    value={customForm.equipment}
                    onChange={(event) =>
                      setCustomForm((prev) => ({ ...prev, equipment: event.target.value }))
                    }
                    placeholder="e.g. Cable"
                    className="h-11 rounded-xl border-zinc-700 bg-zinc-950 text-white"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Difficulty</p>
                  <select
                    value={customForm.difficulty}
                    onChange={(event) =>
                      setCustomForm((prev) => ({
                        ...prev,
                        difficulty: event.target.value as "1" | "2" | "3"
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="1">Easy</option>
                    <option value="2">Medium</option>
                    <option value="3">Hard</option>
                  </select>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Cover Image Upload
                  </p>
                  <label className="flex h-11 cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300 hover:border-zinc-500">
                    <span className="truncate">
                      {coverFile ? coverFile.name : "Choose local image"}
                    </span>
                    <span className="ml-3 inline-flex items-center gap-1 rounded-md border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                      <Upload className="h-3 w-3" />
                      Upload
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setCoverFile(file);
                      }}
                    />
                  </label>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Video Upload (optional)
                  </p>
                  <label className="flex h-11 cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300 hover:border-zinc-500">
                    <span className="truncate">
                      {videoFile ? videoFile.name : "Choose local video"}
                    </span>
                    <span className="ml-3 inline-flex items-center gap-1 rounded-md border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                      <Upload className="h-3 w-3" />
                      Upload
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setVideoFile(file);
                      }}
                    />
                  </label>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Description</p>
                  <textarea
                    value={customForm.description}
                    onChange={(event) =>
                      setCustomForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={4}
                    placeholder="Write movement cues, intent, and safety notes..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
              </div>

              {createError && (
                <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                  {createError}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  onClick={closeCreatePanel}
                  disabled={isCreatingCustomExercise || isUploadingMedia}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                  onClick={() => {
                    void handleCreateCustomExercise();
                  }}
                  disabled={isCreatingCustomExercise || isUploadingMedia}
                >
                  {isUploadingMedia
                    ? "Uploading media..."
                    : isCreatingCustomExercise
                    ? "Creating..."
                    : "Create Exercise"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-200">
                  <GripVertical className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Selected</p>
                  <p className="text-sm font-semibold text-white">
                    {selectedIds.length} movements
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                disabled={selectedExercises.length === 0}
              >
                <Link to="/workout-builder">Review Cart</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


