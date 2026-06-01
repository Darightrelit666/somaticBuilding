import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ChevronLeft,
  Play,
  Flame,
  ShieldCheck,
  Activity,
  Settings2,
  Info,
  AlertTriangle,
  ListChecks,
  Heart,
  Share2,
  Plus,
  MoveRight
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { exercises as localExercises } from '../../shared/data/exercises';
import { ImageWithFallback } from '../../shared/components/figma/ImageWithFallback';
import { fetchExerciseDetail, type ExerciseDetailData } from '../../shared/api/exercises';

const ResponsiveContainerAny = ResponsiveContainer as unknown as React.ComponentType<{
  width: string | number;
  height: string | number;
  children?: React.ReactNode;
}>;

type RegionKey = 'arms' | 'torso' | 'core' | 'hips' | 'legs';
type HeatmapState = Record<RegionKey, number>;
type ProgressStatus = 'completed' | 'current' | 'locked';

type ProgressNode = {
  id: string;
  title: string;
  status: ProgressStatus;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const uniqueStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return hash;
};

const abilityLabels = ['Strength', 'Power', 'Stability', 'Mobility', 'Endurance', 'Coordination'];

const baseAbilityByDifficulty: Record<string, number[]> = {
  Easy: [56, 50, 62, 70, 72, 68],
  Medium: [70, 66, 72, 62, 60, 64],
  Hard: [84, 80, 78, 55, 50, 58]
};

const equipmentAbilityAdjustments: Record<string, number[]> = {
  barbell: [10, 8, 2, -6, -6, -2],
  dumbbell: [4, 2, 4, 2, 0, 4],
  machine: [2, 0, 4, -2, 0, -2],
  bodyweight: [-2, 0, 2, 8, 8, 8],
  kettlebells: [4, 6, 4, 2, 4, 4],
  cable: [2, 0, 4, 0, 2, 2]
};

const muscleAbilityAdjustments: Record<string, number[]> = {
  quadriceps: [6, 4, 4, -2, -2, 0],
  hamstrings: [5, 3, 3, -1, -1, 0],
  glutes: [6, 4, 4, -2, -2, 0],
  calves: [2, 2, 2, 0, 2, 1],
  chest: [4, 3, 1, -2, -2, -1],
  shoulders: [3, 2, 2, 1, -1, 1],
  triceps: [3, 1, 1, -1, -1, 0],
  biceps: [2, 1, 1, 0, -1, 0],
  lats: [4, 2, 2, -1, -1, 1],
  'middle back': [3, 2, 4, -1, 0, 1],
  traps: [3, 2, 3, -2, -1, 0],
  'lower back': [4, 2, 6, -3, -1, 0],
  abdominals: [1, 0, 8, 4, 2, 3],
  forearms: [1, 0, 2, 0, 1, 2],
  neck: [1, 0, 2, 0, 0, 1]
};

const inferSecondaryMuscles = (primaryMuscle: string) => {
  const key = primaryMuscle.toLowerCase();
  if (['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'].includes(key)) {
    return ['Glutes', 'Abdominals'];
  }
  if (['chest', 'shoulders', 'triceps'].includes(key)) {
    return ['Triceps', 'Shoulders'];
  }
  if (['lats', 'middle back', 'traps', 'biceps', 'forearms'].includes(key)) {
    return ['Biceps', 'Forearms'];
  }
  if (key === 'abdominals') {
    return ['Lower Back', 'Glutes'];
  }
  return ['Core', 'Stabilizers'];
};

const splitSentences = (content: string) =>
  content
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/g)
    .map((line) => line.replace(/^\d+[\.)]\s*/, '').trim())
    .filter(Boolean);

const buildAbilityProfile = (exercise: ExerciseDetailData) => {
  const base = [...(baseAbilityByDifficulty[exercise.difficulty] || baseAbilityByDifficulty.Medium)];
  const equipmentKey = exercise.equipmentTag.toLowerCase();
  const muscleKey = (exercise.primaryMuscle || exercise.movementPattern || '').toLowerCase();

  const equipmentAdjust = equipmentAbilityAdjustments[equipmentKey] || [0, 0, 0, 0, 0, 0];
  const muscleAdjust = muscleAbilityAdjustments[muscleKey] || [0, 0, 0, 0, 0, 0];

  const noiseSeed = hashString(`${exercise.id}-${exercise.name}`);
  const chartValues = base.map((value, idx) => {
    const jitter = ((noiseSeed >> (idx * 3)) % 7) - 3;
    return clamp(value + equipmentAdjust[idx] + muscleAdjust[idx] + jitter, 35, 96);
  });

  return abilityLabels.map((subject, idx) => ({
    subject,
    value: chartValues[idx],
    fullMark: 100
  }));
};

const buildExecutionSteps = (
  exercise: ExerciseDetailData,
  primaryMuscle: string,
  secondaryMuscles: string[]
) => {
  const parsed = splitSentences(exercise.description);
  if (parsed.length >= 3) {
    return parsed.slice(0, 6);
  }

  const equipment = exercise.equipmentTag || 'Bodyweight';
  const cue = secondaryMuscles[0] || 'core';
  const loweringCue =
    ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(primaryMuscle.toLowerCase())
      ? 'Control the descent and keep knee/hip alignment stable.'
      : 'Control the eccentric phase and avoid momentum.';

  return [
    `Set up for ${exercise.name} with ${equipment.toLowerCase()} and establish a stable stance.`,
    `Brace your ${cue.toLowerCase()} and align your joints before initiating the movement.`,
    `Drive through the target pattern to emphasize ${primaryMuscle.toLowerCase()} engagement.`,
    loweringCue,
    'Return to the start with control, reset breathing, and repeat for planned reps.'
  ];
};

const buildCautionNotes = (
  exercise: ExerciseDetailData,
  primaryMuscle: string,
  secondaryMuscles: string[]
) => {
  const notes = [
    'Maintain a neutral spine and avoid compensating with uncontrolled momentum.',
    'Use a load you can control through the full range of motion.'
  ];

  if (exercise.difficulty === 'Hard') {
    notes.push('Prioritize warm-up sets before working sets to protect joints and connective tissue.');
  }
  if (exercise.equipmentTag.toLowerCase() === 'barbell') {
    notes.push('Use rack/safety setup and secure plates before each set.');
  }
  if (['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(primaryMuscle.toLowerCase())) {
    notes.push('Track knees in line with toes and avoid sudden knee collapse.');
  }
  if (['chest', 'shoulders', 'triceps'].includes(primaryMuscle.toLowerCase())) {
    notes.push('Keep shoulders packed and avoid aggressive elbow flare.');
  }
  if (secondaryMuscles.map((m) => m.toLowerCase()).includes('lower back')) {
    notes.push('Stop the set if lumbar rounding appears and reset your brace.');
  }

  return uniqueStrings(notes).slice(0, 5);
};

const getRegionForMuscle = (muscle: string): RegionKey[] => {
  const key = muscle.toLowerCase();
  if (['quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors'].includes(key)) {
    return ['legs', 'hips'];
  }
  if (key === 'glutes') {
    return ['hips', 'legs', 'core'];
  }
  if (key === 'abdominals') {
    return ['core', 'torso'];
  }
  if (['chest', 'shoulders', 'triceps', 'biceps', 'forearms'].includes(key)) {
    return ['arms', 'torso'];
  }
  if (['lats', 'middle back', 'traps', 'lower back', 'neck'].includes(key)) {
    return ['torso', 'core'];
  }
  return ['torso'];
};

const buildHeatmapState = (primaryMuscle: string, secondaryMuscles: string[]): HeatmapState => {
  const score: HeatmapState = {
    arms: 0,
    torso: 0,
    core: 0,
    hips: 0,
    legs: 0
  };

  getRegionForMuscle(primaryMuscle).forEach((region) => {
    score[region] += 2;
  });
  secondaryMuscles.slice(0, 3).forEach((muscle) => {
    getRegionForMuscle(muscle).forEach((region) => {
      score[region] += 1;
    });
  });

  return {
    arms: clamp(score.arms, 0, 2),
    torso: clamp(score.torso, 0, 2),
    core: clamp(score.core, 0, 2),
    hips: clamp(score.hips, 0, 2),
    legs: clamp(score.legs, 0, 2)
  };
};

const regionFill = (intensity: number) => {
  if (intensity >= 2) {
    return { fill: '#4c0519', stroke: '#f43f5e', opacity: 0.95 };
  }
  if (intensity >= 1) {
    return { fill: '#451a03', stroke: '#f59e0b', opacity: 0.85 };
  }
  return { fill: '#27272a', stroke: '#3f3f46', opacity: 0.65 };
};

const buildProgression = (abilityTag: string, equipmentTag: string, primaryMuscle: string): ProgressNode[] => {
  const stages = ['Beginner', 'Intermediate', 'Advanced'];
  const currentIndex = Math.max(0, stages.indexOf(abilityTag));
  const titles = [
    `${primaryMuscle} Foundation`,
    `${equipmentTag} Control`,
    `${primaryMuscle} Mastery`
  ];

  return stages.map((stage, idx) => ({
    id: stage.toLowerCase(),
    title: titles[idx],
    status: idx < currentIndex ? 'completed' : idx === currentIndex ? 'current' : 'locked'
  }));
};

const HeatmapBody = ({ state }: { state: HeatmapState }) => {
  const torso = regionFill(state.torso);
  const core = regionFill(state.core);
  const arms = regionFill(state.arms);
  const hips = regionFill(state.hips);
  const legs = regionFill(state.legs);

  return (
    <svg viewBox="0 0 200 400" className="w-full h-[280px] drop-shadow-2xl">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <circle cx="100" cy="40" r="22" fill="#27272a" stroke="#3f3f46" strokeWidth="3" />

      <path
        d="M50 80 Q100 60 150 80 L140 160 Q100 180 60 160 Z"
        fill={torso.fill}
        stroke={torso.stroke}
        strokeWidth="3"
        opacity={torso.opacity}
        filter="url(#glow)"
      />
      <path
        d="M65 170 L135 170 L125 240 L75 240 Z"
        fill={core.fill}
        stroke={core.stroke}
        strokeWidth="2"
        opacity={core.opacity}
        filter="url(#glow)"
      />

      <path
        d="M40 90 L20 160 L15 220"
        fill="none"
        stroke={arms.stroke}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={arms.opacity}
        filter="url(#glow)"
      />
      <path
        d="M160 90 L180 160 L185 220"
        fill="none"
        stroke={arms.stroke}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={arms.opacity}
        filter="url(#glow)"
      />

      <path
        d="M70 245 L130 245 L140 280 L60 280 Z"
        fill={hips.fill}
        stroke={hips.stroke}
        strokeWidth="2"
        opacity={hips.opacity}
        filter="url(#glow)"
      />

      <path
        d="M65 290 L50 380"
        fill="none"
        stroke={legs.stroke}
        strokeWidth="20"
        strokeLinecap="round"
        opacity={legs.opacity}
        filter="url(#glow)"
      />
      <path
        d="M135 290 L150 380"
        fill="none"
        stroke={legs.stroke}
        strokeWidth="20"
        strokeLinecap="round"
        opacity={legs.opacity}
        filter="url(#glow)"
      />
    </svg>
  );
};

export function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const fallbackExercise = useMemo<ExerciseDetailData>(() => {
    const matched = localExercises.find((e) => e.id === id) || localExercises[0];
    return {
      ...matched,
      description: '',
      primaryMuscle: matched?.movementPattern || 'General',
      secondaryMuscles: [],
      categoryTags: [],
      videoUrl: undefined
    };
  }, [id]);

  const [exercise, setExercise] = useState<ExerciseDetailData>(fallbackExercise);
  const [detailSyncError, setDetailSyncError] = useState<string | null>(null);
  const [videoHint, setVideoHint] = useState<string | null>(null);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  useEffect(() => {
    setExercise(fallbackExercise);
  }, [fallbackExercise]);

  useEffect(() => {
    setIsVideoOpen(false);
  }, [exercise.id]);

  useEffect(() => {
    if (!videoHint) return;
    const timer = window.setTimeout(() => setVideoHint(null), 2200);
    return () => window.clearTimeout(timer);
  }, [videoHint]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadDetail = async () => {
      try {
        const remote = await fetchExerciseDetail(id);
        if (cancelled) return;
        setExercise(remote);
        setDetailSyncError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Exercise detail sync failed.';
        setDetailSyncError(message);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/library');
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'text-emerald-400 border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.3)] bg-emerald-400/10';
      case 'Medium':
        return 'text-amber-400 border-amber-400/30 shadow-[0_0_10px_rgba(251,191,36,0.3)] bg-amber-400/10';
      case 'Hard':
        return 'text-rose-400 border-rose-400/30 shadow-[0_0_10px_rgba(244,63,94,0.3)] bg-rose-400/10';
      default:
        return 'text-zinc-400 border-zinc-700 bg-zinc-800';
    }
  };

  const primaryMuscle = exercise.primaryMuscle || exercise.movementPattern || 'General';
  const secondaryMuscles = useMemo(() => {
    if (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0) {
      return uniqueStrings(exercise.secondaryMuscles).slice(0, 3);
    }
    return inferSecondaryMuscles(primaryMuscle).slice(0, 3);
  }, [exercise.secondaryMuscles, primaryMuscle]);

  const chartData = useMemo(() => buildAbilityProfile(exercise), [exercise]);
  const executionSteps = useMemo(
    () => buildExecutionSteps(exercise, primaryMuscle, secondaryMuscles),
    [exercise, primaryMuscle, secondaryMuscles]
  );
  const cautionNotes = useMemo(
    () => buildCautionNotes(exercise, primaryMuscle, secondaryMuscles),
    [exercise, primaryMuscle, secondaryMuscles]
  );
  const heatmapState = useMemo(
    () => buildHeatmapState(primaryMuscle, secondaryMuscles),
    [primaryMuscle, secondaryMuscles]
  );
  const progressions = useMemo(
    () => buildProgression(exercise.abilityTag, exercise.equipmentTag, primaryMuscle),
    [exercise.abilityTag, exercise.equipmentTag, primaryMuscle]
  );
  const canPlayVideo = Boolean(exercise.videoUrl);
  const isGifPreview = Boolean(exercise.videoUrl && /\.gif(?:$|\?)/i.test(exercise.videoUrl));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-28 selection:bg-lime-400/30 selection:text-lime-950 flex flex-col items-center">
      <div className="relative w-full max-w-3xl aspect-[4/3] sm:aspect-video bg-zinc-900 overflow-hidden shrink-0">
        <ImageWithFallback src={exercise.imageUrl} alt={exercise.name} className="w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-zinc-950/40 pointer-events-none"></div>

        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-30">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-3">
            <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-rose-400 transition-colors">
              <Heart className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-lime-400 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              if (!canPlayVideo) {
                setVideoHint('No video for this exercise yet. Image only.');
                return;
              }
              setIsVideoOpen(true);
            }}
            className={[
              "w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 pl-1.5 pointer-events-auto transition-colors",
              canPlayVideo
                ? "bg-lime-400/90 text-zinc-950 shadow-[0_0_30px_rgba(163,230,53,0.4)] border-lime-300"
                : "bg-zinc-700/80 text-zinc-200 border-zinc-500 cursor-not-allowed"
            ].join(" ")}
          >
            <Play className="w-8 h-8 fill-current" />
          </motion.button>
        </div>
        {videoHint && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-md border border-zinc-700 bg-black/70 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
            {videoHint}
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl px-4 sm:px-6 -mt-8 relative z-20 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight uppercase">{exercise.name}</h1>
            <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-sm uppercase tracking-wider ${getDifficultyColor(exercise.difficulty)}`}>
              <Flame className="w-4 h-4" />
              {exercise.difficulty}
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm font-semibold text-zinc-300">
              <Activity className="w-4 h-4 text-indigo-400" />
              {primaryMuscle}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm font-semibold text-zinc-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              {exercise.abilityTag}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm font-semibold text-zinc-300">
              <Settings2 className="w-4 h-4 text-lime-400" />
              {exercise.equipmentTag}
            </div>
            {(exercise.categoryTags ?? []).map((tag) => (
              <div key={tag} className="px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-md text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {tag}
              </div>
            ))}
          </div>
          {detailSyncError && <p className="text-xs text-amber-300">Detail sync warning: {detailSyncError}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-lime-400" />
              <h2 className="text-lg font-bold tracking-wide uppercase">Ability Profile</h2>
            </div>
            <div className="flex-1 w-full min-h-[220px]">
              <ResponsiveContainerAny width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Exercise"
                    dataKey="value"
                    stroke="#a3e635"
                    strokeWidth={2}
                    fill="#a3e635"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainerAny>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-rose-400" />
                <h2 className="text-lg font-bold tracking-wide uppercase">Muscle Target</h2>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center relative">
              <HeatmapBody state={heatmapState} />

              <div className="absolute top-0 right-0 flex flex-col gap-2 text-[10px] font-bold uppercase tracking-wider bg-zinc-950/80 p-2 rounded-lg border border-zinc-800 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]"></div>
                  <span className="text-zinc-300">Primary ({primaryMuscle})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b]"></div>
                  <span className="text-zinc-300">
                    Secondary ({secondaryMuscles.length > 0 ? secondaryMuscles.join(' / ') : 'Stabilizers'})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2 px-1">
            <ListChecks className="w-5 h-5 text-lime-400" />
            <h2 className="text-xl font-bold tracking-wide uppercase">Execution Steps</h2>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
            <div className="space-y-6">
              {executionSteps.map((step, idx) => (
                <div key={`${idx}-${step.slice(0, 12)}`} className="flex gap-4 relative">
                  {idx !== executionSteps.length - 1 && (
                    <div className="absolute top-8 left-3.5 w-[2px] h-[calc(100%-8px)] bg-zinc-800"></div>
                  )}
                  <div className="w-7 h-7 shrink-0 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-xs font-bold text-lime-400 relative z-10">
                    {idx + 1}
                  </div>
                  <div className="flex-1 pt-1 pb-1">
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-5 flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 text-rose-400 mb-1">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-widest">Caution</h3>
          </div>
          <ul className="space-y-2">
            {cautionNotes.map((note, idx) => (
              <li key={`${idx}-${note.slice(0, 12)}`} className="flex items-start gap-2 text-sm text-rose-200/80">
                <span className="text-rose-500 mt-1">-</span>
                {note}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 mt-6 mb-8">
          <div className="flex items-center gap-2 px-1">
            <MoveRight className="w-5 h-5 text-lime-400" />
            <h2 className="text-xl font-bold tracking-wide uppercase">Progression Path</h2>
          </div>

          <div className="relative w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory py-4">
            <div className="absolute top-1/2 left-0 w-[700px] h-1.5 bg-zinc-800 -translate-y-1/2 rounded-full z-0">
              <div
                className="h-full bg-lime-400 rounded-full shadow-[0_0_10px_rgba(163,230,53,0.5)]"
                style={{ width: `${(progressions.filter((p) => p.status !== 'locked').length / progressions.length) * 100}%` }}
              ></div>
            </div>

            <div className="flex gap-6 relative z-10 px-2 min-w-max">
              {progressions.map((node) => {
                const isCompleted = node.status === 'completed';
                const isCurrent = node.status === 'current';
                const isLocked = node.status === 'locked';

                return (
                  <div key={node.id} className="snap-center shrink-0 w-40 flex flex-col items-center gap-3">
                    <div
                      className={`relative w-20 h-20 rounded-2xl border-4 transition-all duration-300 flex items-center justify-center bg-zinc-900
                        ${isCompleted ? 'border-lime-400 opacity-80' : ''}
                        ${isCurrent ? 'border-lime-400 scale-110 shadow-[0_0_20px_rgba(163,230,53,0.4)] z-20' : ''}
                        ${isLocked ? 'border-zinc-800 opacity-50 grayscale' : ''}
                      `}
                    >
                      <span className="text-xl font-black">{node.id === 'beginner' ? '1' : node.id === 'intermediate' ? '2' : '3'}</span>
                      {isCompleted && <div className="absolute -top-2 -right-2 w-6 h-5 rounded-full bg-lime-400 text-zinc-950 text-[10px] font-black flex items-center justify-center">OK</div>}
                    </div>

                    <div className="text-center">
                      <p
                        className={`text-xs font-bold leading-tight uppercase
                          ${isCurrent ? 'text-lime-400' : isCompleted ? 'text-zinc-300' : 'text-zinc-600'}
                        `}
                      >
                        {node.title}
                      </p>
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-1 block">
                        {node.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent z-[60] pointer-events-none">
        <div className="max-w-3xl mx-auto flex gap-3 pointer-events-auto mt-8">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                const stored = window.localStorage.getItem('workoutCart');
                const parsed = stored ? (JSON.parse(stored) as string[]) : [];
                const next = Array.isArray(parsed) ? Array.from(new Set([...parsed, exercise.id])) : [exercise.id];
                window.localStorage.setItem('workoutCart', JSON.stringify(next));
              }
              navigate('/library');
            }}
            className="flex-1 py-4 px-6 rounded-2xl bg-lime-400 text-zinc-950 font-black text-sm uppercase tracking-wider hover:bg-lime-300 transition-colors shadow-[0_0_25px_rgba(163,230,53,0.3)] flex items-center justify-center gap-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Add to Workout
          </button>
        </div>
      </div>

      {isVideoOpen && exercise.videoUrl && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setIsVideoOpen(false)}
            className="absolute inset-0"
            aria-label="Close video"
          />
          <div className="relative w-full max-w-3xl rounded-xl border border-zinc-700 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">{exercise.name}</p>
              <button
                type="button"
                onClick={() => setIsVideoOpen(false)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            {isGifPreview ? (
              <img
                src={exercise.videoUrl}
                alt={exercise.name}
                className="w-full max-h-[75vh] rounded-lg bg-black object-contain"
              />
            ) : (
              <video
                src={exercise.videoUrl}
                controls
                autoPlay
                className="w-full max-h-[75vh] rounded-lg bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
