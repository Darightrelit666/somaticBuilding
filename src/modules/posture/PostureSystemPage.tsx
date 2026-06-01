import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  Activity,
  Cpu,
  Info,
  LayoutDashboard,
  Play,
  Settings,
  Share2 as Hub,
  ShieldAlert,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Bounds, Html, Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate } from "react-router";
import { fetchExerciseList } from "../../shared/api/exercises";
import { createWorkoutTemplate, type WorkoutTemplateExercise } from "../../shared/api/workout";
import { resolveWorkoutUserId } from "../training/trainingHubUtils";
import type { Dysfunction, JointData, JointStatus } from "./types";

const JOINTS: JointData[] = [
  {
    id: "head",
    name: "Head",
    mobility: 84,
    stability: 86,
    motorControl: 88,
    status: "OPTIMAL",
    description: "Cranio-cervical control is generally stable with efficient gaze tracking.",
    position: { top: "8%", left: "50%" }
  },
  {
    id: "neck",
    name: "Neck",
    mobility: 67,
    stability: 72,
    motorControl: 69,
    status: "CAUTIONARY",
    description: "Reduced cervical rotation tolerance under sustained postural demand.",
    position: { top: "15%", left: "50%" }
  },
  {
    id: "c-spine",
    name: "Cervical Spine",
    mobility: 71,
    stability: 76,
    motorControl: 73,
    status: "CAUTIONARY",
    description: "Upper spinal segment demonstrates moderate stiffness and compensation.",
    position: { top: "22%", left: "50%" }
  },
  {
    id: "t-spine",
    name: "Thoracic Spine",
    mobility: 83,
    stability: 82,
    motorControl: 80,
    status: "OPTIMAL",
    description: "Thoracic extension and rotation patterns remain resilient.",
    position: { top: "31%", left: "50%" }
  },
  {
    id: "lumbar-spine",
    name: "Lumbar Spine",
    mobility: 64,
    stability: 70,
    motorControl: 66,
    status: "CAUTIONARY",
    description: "Segmental control decreases during load transfer and hip hinge tasks.",
    position: { top: "40%", left: "50%" }
  },
  {
    id: "pelvis",
    name: "Pelvis",
    mobility: 69,
    stability: 74,
    motorControl: 68,
    status: "CAUTIONARY",
    description: "Pelvic alignment shows mild asymmetry in frontal and transverse planes.",
    position: { top: "50%", left: "50%" }
  },
  {
    id: "l-shoulder",
    name: "Left Shoulder",
    mobility: 88,
    stability: 92,
    motorControl: 85,
    status: "OPTIMAL",
    description: "Glenohumeral joint showing excellent centration and dynamic stability.",
    position: { top: "23%", left: "37%" }
  },
  {
    id: "r-shoulder",
    name: "Right Shoulder",
    mobility: 72,
    stability: 78,
    motorControl: 71,
    status: "CAUTIONARY",
    description: "Scapulohumeral rhythm is delayed at overhead ranges.",
    position: { top: "23%", left: "63%" }
  },
  {
    id: "l-elbow",
    name: "Left Elbow",
    mobility: 87,
    stability: 85,
    motorControl: 84,
    status: "OPTIMAL",
    description: "Elbow extension-flexion path is smooth with stable forearm tracking.",
    position: { top: "37%", left: "29%" }
  },
  {
    id: "r-elbow",
    name: "Right Elbow",
    mobility: 81,
    stability: 79,
    motorControl: 77,
    status: "OPTIMAL",
    description: "Right elbow mechanics are acceptable with minor terminal extension drift.",
    position: { top: "37%", left: "71%" }
  },
  {
    id: "l-wrist",
    name: "Left Wrist",
    mobility: 74,
    stability: 76,
    motorControl: 73,
    status: "CAUTIONARY",
    description: "Load-bearing wrist extension is mildly limited on left side.",
    position: { top: "48%", left: "24%" }
  },
  {
    id: "r-wrist",
    name: "Right Wrist",
    mobility: 82,
    stability: 84,
    motorControl: 80,
    status: "OPTIMAL",
    description: "Right wrist demonstrates robust control during grip and support tasks.",
    position: { top: "48%", left: "76%" }
  },
  {
    id: "l-hip",
    name: "Left Hip",
    mobility: 84,
    stability: 82,
    motorControl: 83,
    status: "OPTIMAL",
    description: "Left hip shows clean rotary control and good frontal-plane stability.",
    position: { top: "55%", left: "44%" }
  },
  {
    id: "r-hip",
    name: "Right Hip",
    mobility: 62,
    stability: 75,
    motorControl: 68,
    status: "CAUTIONARY",
    description: "Internal rotation deficit detected. Compensatory shear in pelvic-femoral rhythm.",
    position: { top: "55%", left: "56%" }
  },
  {
    id: "l-knee",
    name: "Left Knee",
    mobility: 95,
    stability: 90,
    motorControl: 92,
    status: "OPTIMAL",
    description: "Optimal tracking and terminal extension control.",
    position: { top: "72%", left: "44%" }
  },
  {
    id: "r-knee",
    name: "Right Knee",
    mobility: 71,
    stability: 74,
    motorControl: 69,
    status: "CAUTIONARY",
    description: "Valgus tendency appears under fatigue and deceleration.",
    position: { top: "72%", left: "56%" }
  },
  {
    id: "l-ankle",
    name: "Left Ankle",
    mobility: 45,
    stability: 70,
    motorControl: 65,
    status: "CRITICAL",
    description: "Severe dorsiflexion restriction. Structural talocrural block identified.",
    position: { top: "90%", left: "45%" }
  },
  {
    id: "r-ankle",
    name: "Right Ankle",
    mobility: 68,
    stability: 73,
    motorControl: 67,
    status: "CAUTIONARY",
    description: "Moderate stiffness limits shock absorption during landing.",
    position: { top: "90%", left: "55%" }
  }
];

const DYSFUNCTIONS: Dysfunction[] = [
  {
    id: "d1",
    jointId: "l-ankle",
    name: "Dorsiflexion Restriction",
    severity: "CRITICAL",
    delta: "-12 deg delta from baseline",
    note: "Structural talocrural block"
  },
  {
    id: "d2",
    jointId: "r-hip",
    name: "Internal Rotation Deficit",
    severity: "WARNING",
    delta: "Compensatory shear pattern",
    note: "Right hip"
  },
  {
    id: "d3",
    jointId: "lumbar-spine",
    name: "Segmental Control Drop",
    severity: "WARNING",
    delta: "Load-transfer drift",
    note: "Lumbar spine"
  },
  {
    id: "d4",
    jointId: "neck",
    name: "Cervical Endurance Limitation",
    severity: "WARNING",
    delta: "Sustained posture intolerance",
    note: "Neck complex"
  },
  {
    id: "d5",
    jointId: "r-ankle",
    name: "Impact Attenuation Delay",
    severity: "WARNING",
    delta: "Landing stiffness",
    note: "Right ankle"
  },
  {
    id: "d6",
    jointId: "pelvis",
    name: "Pelvic Rotation Drift",
    severity: "WARNING",
    delta: "Frontal/transverse mismatch",
    note: "Pelvic control"
  }
];

type JointProtocol = {
  scanCode: string;
  patternHeadline: string;
  targetLabel: string;
  coordinate: string;
  protocolName: string;
  duration: string;
  intensity: "LOW" | "MOD" | "HIGH";
  target: string;
  exerciseLabel: string;
  instruction: string;
  repetitions: string;
  tempo: string;
};

type JointScanMedia = {
  src: string;
  objectPosition: string;
  zoom: number;
  flipX?: boolean;
};

const JOINT_PROTOCOLS: Record<string, JointProtocol> = {
  head: {
    scanCode: "HEAD_ALIGN_CTRL_V1",
    patternHeadline: "Cranial Alignment Review",
    targetLabel: "Target: Head Positioning",
    coordinate: "COORD: 34.26.N // 118.21.W",
    protocolName: "Maintenance-Head",
    duration: "8 MIN",
    intensity: "LOW",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/03: Deep Neck Flexor Nod",
    instruction:
      "Maintain neutral jaw and perform low-amplitude nods while keeping cervical length. Focus on precision and breathing cadence.",
    repetitions: "12 REPS",
    tempo: "2-2-2"
  },
  neck: {
    scanCode: "CERVICAL_LOAD_SAFE_V2",
    patternHeadline: "Cervical Endurance Deficit",
    targetLabel: "Target: Neck Stabilization",
    coordinate: "COORD: 34.25.N // 118.21.W",
    protocolName: "Restoration-Neck",
    duration: "12 MIN",
    intensity: "MOD",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/04: Isometric Cervical Matrix",
    instruction:
      "Generate gentle multidirectional cervical tension without compensating through upper traps. Maintain stacked posture.",
    repetitions: "4 x 20S HOLDS",
    tempo: "ISO"
  },
  "c-spine": {
    scanCode: "CSPINE_MOB_SCAN_V1",
    patternHeadline: "Upper Spine Segment Restriction",
    targetLabel: "Target: Cervical Spine Mobility",
    coordinate: "COORD: 34.25.N // 118.22.W",
    protocolName: "Restoration-CSpine",
    duration: "11 MIN",
    intensity: "MOD",
    target: "MOBILITY",
    exerciseLabel: "Exercise 01/03: Segmental Rotation Drill",
    instruction:
      "Rotate through comfortable range one segment at a time while maintaining rib cage control and smooth tempo.",
    repetitions: "10 PER SIDE",
    tempo: "3-1-2"
  },
  "t-spine": {
    scanCode: "TSPINE_EXT_ROT_V1",
    patternHeadline: "Thoracic Rotation Check",
    targetLabel: "Target: Thoracic Extension/Rotation",
    coordinate: "COORD: 34.24.N // 118.22.W",
    protocolName: "Maintenance-TSpine",
    duration: "10 MIN",
    intensity: "LOW",
    target: "MOBILITY",
    exerciseLabel: "Exercise 01/03: Quadruped Thread-the-Needle",
    instruction:
      "Drive rotation from thoracic segments while keeping hips stable and neck relaxed. Prioritize end-range control.",
    repetitions: "8-10 PER SIDE",
    tempo: "2-1-2"
  },
  "lumbar-spine": {
    scanCode: "LSPINE_BRACE_CTRL_V2",
    patternHeadline: "Load Transfer Instability",
    targetLabel: "Target: Lumbar Segment Control",
    coordinate: "COORD: 34.23.N // 118.23.W",
    protocolName: "Restoration-LSpine",
    duration: "15 MIN",
    intensity: "MOD",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/04: Dead Bug Anti-Extension",
    instruction:
      "Press low back gently into support and alternate limb movement without losing trunk position or breath rhythm.",
    repetitions: "10 PER SIDE",
    tempo: "2-2-2"
  },
  pelvis: {
    scanCode: "PELVIS_CONTROL_SYNC_V2",
    patternHeadline: "Pelvic Rotation Drift",
    targetLabel: "Target: Pelvic Symmetry",
    coordinate: "COORD: 34.22.N // 118.23.W",
    protocolName: "Restoration-Pelvis",
    duration: "13 MIN",
    intensity: "MOD",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/04: Split-Stance Pelvic Shift",
    instruction:
      "Shift pelvis in controlled frontal and transverse planes while preserving foot tripod and rib-pelvis stack.",
    repetitions: "8-10 PER SIDE",
    tempo: "3-1-2"
  },
  "l-shoulder": {
    scanCode: "L_SHOULDER_SCAP_CTRL_V2",
    patternHeadline: "Scapular Rhythm Tracking",
    targetLabel: "Target: Left Shoulder Complex",
    coordinate: "COORD: 34.20.N // 118.18.W",
    protocolName: "Maintenance-LShoulder",
    duration: "10 MIN",
    intensity: "LOW",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/03: Scapular Wall Slide",
    instruction:
      "Maintain rib stack and smooth scapular upward rotation. Focus on quality control and end-range ownership.",
    repetitions: "10-12 REPS",
    tempo: "2-1-2"
  },
  "r-shoulder": {
    scanCode: "R_SHOULDER_SCAP_CTRL_V2",
    patternHeadline: "Delayed Overhead Timing",
    targetLabel: "Target: Right Shoulder Complex",
    coordinate: "COORD: 34.20.N // 118.19.W",
    protocolName: "Restoration-RShoulder",
    duration: "12 MIN",
    intensity: "MOD",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/04: Landmine Press Patterning",
    instruction:
      "Drive controlled overhead path while keeping scapula and rib cage synchronized. Avoid upper-trap dominance.",
    repetitions: "8-10 REPS",
    tempo: "3-1-2"
  },
  "l-elbow": {
    scanCode: "L_ELBOW_TRACK_SAFE_V1",
    patternHeadline: "Forearm Hinge Integrity",
    targetLabel: "Target: Left Elbow Tracking",
    coordinate: "COORD: 34.19.N // 118.18.W",
    protocolName: "Maintenance-LElbow",
    duration: "8 MIN",
    intensity: "LOW",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/03: Band-Supported Extension",
    instruction:
      "Control flexion and extension through full range without shoulder compensation. Maintain neutral wrist alignment.",
    repetitions: "12 REPS",
    tempo: "2-1-2"
  },
  "r-elbow": {
    scanCode: "R_ELBOW_TRACK_SAFE_V1",
    patternHeadline: "Extension Control Monitoring",
    targetLabel: "Target: Right Elbow Tracking",
    coordinate: "COORD: 34.19.N // 118.19.W",
    protocolName: "Maintenance-RElbow",
    duration: "8 MIN",
    intensity: "LOW",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/03: Prone Triceps Reach",
    instruction:
      "Reach and extend with stable scapula positioning. Keep forearm path linear and avoid wrist collapse.",
    repetitions: "10-12 REPS",
    tempo: "2-1-2"
  },
  "l-wrist": {
    scanCode: "L_WRIST_LOAD_TOL_V2",
    patternHeadline: "Load-Bearing Extension Limit",
    targetLabel: "Target: Left Wrist Capacity",
    coordinate: "COORD: 34.18.N // 118.18.W",
    protocolName: "Restoration-LWrist",
    duration: "11 MIN",
    intensity: "MOD",
    target: "MOBILITY",
    exerciseLabel: "Exercise 01/04: Controlled Wrist Rock",
    instruction:
      "Progressively shift load over wrist while maintaining finger activation and neutral forearm rotation.",
    repetitions: "10 PER SIDE",
    tempo: "3-1-2"
  },
  "r-wrist": {
    scanCode: "R_WRIST_LOAD_TOL_V1",
    patternHeadline: "Grip and Support Validation",
    targetLabel: "Target: Right Wrist Capacity",
    coordinate: "COORD: 34.18.N // 118.19.W",
    protocolName: "Maintenance-RWrist",
    duration: "8 MIN",
    intensity: "LOW",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/03: Isometric Wrist Extension",
    instruction:
      "Maintain joint stacking under low load and improve extensor endurance with stable shoulder support.",
    repetitions: "4 x 20S HOLDS",
    tempo: "ISO"
  },
  "l-hip": {
    scanCode: "L_HIP_ROT_CTRL_V2",
    patternHeadline: "Hip Rotation Efficiency",
    targetLabel: "Target: Left Hip Rotation",
    coordinate: "COORD: 34.21.N // 118.20.W",
    protocolName: "Maintenance-LHip",
    duration: "12 MIN",
    intensity: "LOW",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/03: Controlled Hip Airplane",
    instruction:
      "Rotate from the femoral head while preserving pelvic orientation and tripod foot pressure.",
    repetitions: "8 PER SIDE",
    tempo: "3-1-2"
  },
  "r-hip": {
    scanCode: "R_HIP_ROT_CTRL_V3",
    patternHeadline: "Pelvic Shear Compensation",
    targetLabel: "Target: Right Hip Internal Rotation",
    coordinate: "COORD: 34.21.N // 118.20.W",
    protocolName: "Restoration-RHip",
    duration: "16 MIN",
    intensity: "MOD",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/04: Supported Hip Airplane",
    instruction:
      "Keep pelvis square and move from hip socket without lumbar compensation. Build internal rotation capacity.",
    repetitions: "8-10 PER SIDE",
    tempo: "3-1-2"
  },
  "l-knee": {
    scanCode: "L_KNEE_TRACK_SAFE_V1",
    patternHeadline: "Joint Tracking Verification",
    targetLabel: "Target: Left Knee Tracking",
    coordinate: "COORD: 34.24.N // 118.16.W",
    protocolName: "Maintenance-LKnee",
    duration: "9 MIN",
    intensity: "LOW",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/03: Terminal Knee Extension Hold",
    instruction:
      "Maintain tripod foot and control tibial progression through extension with strict knee alignment.",
    repetitions: "10 REPS + 5S HOLD",
    tempo: "2-0-3"
  },
  "r-knee": {
    scanCode: "R_KNEE_VALGUS_CTRL_V2",
    patternHeadline: "Dynamic Valgus Tendency",
    targetLabel: "Target: Right Knee Stability",
    coordinate: "COORD: 34.24.N // 118.17.W",
    protocolName: "Restoration-RKnee",
    duration: "12 MIN",
    intensity: "MOD",
    target: "STABILITY",
    exerciseLabel: "Exercise 01/04: Split Squat Alignment Drill",
    instruction:
      "Track knee over second toe while controlling pelvis and trunk. Emphasize deceleration and frontal-plane control.",
    repetitions: "8-10 PER SIDE",
    tempo: "3-1-2"
  },
  "l-ankle": {
    scanCode: "L_TALOCRURAL_SYS_V2",
    patternHeadline: "Asymmetric Load Pattern",
    targetLabel: "Target: Left Talocrural Joint",
    coordinate: "COORD: 34.22.N // 118.24.W",
    protocolName: "Restoration-LAnkle",
    duration: "14 MIN",
    intensity: "MOD",
    target: "MOBILITY",
    exerciseLabel: "Exercise 01/04: Wall-Supported Dorsiflexion",
    instruction:
      "Maintain heel contact and drive knee forward while keeping arch tension to recover dorsiflexion under load.",
    repetitions: "12 PER SIDE",
    tempo: "2-2-2"
  },
  "r-ankle": {
    scanCode: "R_TALOCRURAL_SYS_V1",
    patternHeadline: "Landing Stiffness Pattern",
    targetLabel: "Target: Right Talocrural Joint",
    coordinate: "COORD: 34.22.N // 118.25.W",
    protocolName: "Restoration-RAnkle",
    duration: "12 MIN",
    intensity: "MOD",
    target: "MOBILITY",
    exerciseLabel: "Exercise 01/04: Eccentric Calf Lowering",
    instruction:
      "Control lowering phase and keep ankle-knee line stable to improve force absorption and dorsiflexion tolerance.",
    repetitions: "10-12 REPS",
    tempo: "3-1-2"
  }
};

const DEFAULT_SCAN_MEDIA: JointScanMedia = {
  src: "/images/posture/ct/pelvis.svg",
  objectPosition: "50% 50%",
  zoom: 1
};

const JOINT_SCAN_MEDIA: Record<string, JointScanMedia> = {
  head: { src: "/images/posture/ct/head.svg", objectPosition: "50% 50%", zoom: 1.02 },
  neck: { src: "/images/posture/ct/neck.svg", objectPosition: "50% 50%", zoom: 1.02 },
  "c-spine": { src: "/images/posture/ct/c-spine.svg", objectPosition: "50% 50%", zoom: 1.02 },
  "t-spine": { src: "/images/posture/ct/t-spine.svg", objectPosition: "50% 50%", zoom: 1.02 },
  "lumbar-spine": { src: "/images/posture/ct/lumbar-spine.svg", objectPosition: "50% 50%", zoom: 1.01 },
  pelvis: { src: "/images/posture/ct/pelvis.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-shoulder": { src: "/images/posture/ct/l-shoulder.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "r-shoulder": { src: "/images/posture/ct/r-shoulder.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-elbow": { src: "/images/posture/ct/l-elbow.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "r-elbow": { src: "/images/posture/ct/r-elbow.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-wrist": { src: "/images/posture/ct/l-wrist.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "r-wrist": { src: "/images/posture/ct/r-wrist.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-hip": { src: "/images/posture/ct/l-hip.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "r-hip": { src: "/images/posture/ct/r-hip.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-knee": { src: "/images/posture/ct/l-knee.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "r-knee": { src: "/images/posture/ct/r-knee.svg", objectPosition: "50% 50%", zoom: 1.01 },
  "l-ankle": {
    src: "/images/posture/ct-real/ankle-ct-reference.png",
    objectPosition: "50% 50%",
    zoom: 1.08,
    flipX: true
  },
  "r-ankle": {
    src: "/images/posture/ct-real/ankle-ct-reference.png",
    objectPosition: "50% 50%",
    zoom: 1.08
  }
};

const DEFAULT_JOINT_ID =
  DYSFUNCTIONS.find((item) => item.severity === "CRITICAL")?.jointId || JOINTS[0]?.id || null;

const statusLabel = (status: JointStatus) => {
  if (status === "CRITICAL") return "Impaired";
  if (status === "CAUTIONARY") return "Compensating";
  return "Optimal";
};

const metricStatusLabel = (status: JointStatus) => {
  if (status === "CRITICAL") return "CRITICAL DYSFUNCTION";
  if (status === "CAUTIONARY") return "CAUTIONARY";
  return "OPTIMAL MAINTENANCE";
};

const metricColor = (status: JointStatus): "red" | "amber" =>
  status === "CRITICAL" ? "red" : "amber";

const protocolForJoint = (jointId: string): JointProtocol =>
  JOINT_PROTOCOLS[jointId] || {
    scanCode: "JOINT_SCAN_GENERIC",
    patternHeadline: "Movement Pattern Review",
    targetLabel: "Target: Selected Joint",
    coordinate: "COORD: N/A",
    protocolName: "Restoration-G",
    duration: "12 MIN",
    intensity: "MOD",
    target: "CONTROL",
    exerciseLabel: "Exercise 01/03: Controlled Mobility Drill",
    instruction:
      "Move through pain-free range while maintaining neutral alignment and consistent tempo.",
    repetitions: "10-12 REPS",
    tempo: "2-2-2"
  };

const scanMediaForJoint = (jointId: string): JointScanMedia =>
  JOINT_SCAN_MEDIA[jointId] || DEFAULT_SCAN_MEDIA;

const JOINT_MODULE_KEYWORDS: Record<string, string[]> = {
  head: ["neck", "cervical", "posture", "chin", "head"],
  neck: ["neck", "cervical", "posture", "mobility"],
  "c-spine": ["cervical", "spine", "thoracic", "mobility"],
  "t-spine": ["thoracic", "spine", "rotation", "extension", "mobility"],
  "lumbar-spine": ["lumbar", "core", "spine", "stability", "hinge"],
  pelvis: ["pelvis", "hip", "core", "stability", "glute"],
  "l-shoulder": ["shoulder", "scap", "upper", "mobility"],
  "r-shoulder": ["shoulder", "scap", "upper", "mobility"],
  "l-elbow": ["elbow", "arm", "triceps", "biceps"],
  "r-elbow": ["elbow", "arm", "triceps", "biceps"],
  "l-wrist": ["wrist", "forearm", "grip", "mobility"],
  "r-wrist": ["wrist", "forearm", "grip", "mobility"],
  "l-hip": ["hip", "glute", "adductor", "rotation"],
  "r-hip": ["hip", "glute", "adductor", "rotation"],
  "l-knee": ["knee", "quad", "hamstring", "stability"],
  "r-knee": ["knee", "quad", "hamstring", "stability"],
  "l-ankle": ["ankle", "calf", "foot", "mobility", "balance"],
  "r-ankle": ["ankle", "calf", "foot", "mobility", "balance"]
};

type LaunchExerciseCandidate = {
  id: number;
  name: string;
  movementPattern: string;
};

const pickModuleExercisesForJoint = (
  jointId: string,
  list: LaunchExerciseCandidate[]
): WorkoutTemplateExercise[] => {
  const keywords = JOINT_MODULE_KEYWORDS[jointId] ?? ["mobility", "stability", "strength"];
  const scored = list
    .map((item) => {
      const haystack = `${item.name} ${item.movementPattern}`.toLowerCase();
      const score = keywords.reduce((acc, keyword) => acc + (haystack.includes(keyword) ? 1 : 0), 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored
    .filter((row) => row.score > 0)
    .slice(0, 4)
    .map((row) => row.item);

  const fallback = selected.length > 0 ? selected : list.slice(0, 4);

  return fallback.map((exercise, index) => ({
    exerciseId: exercise.id,
    sets: 3,
    reps: 10,
    restSeconds: 45,
    timeSeconds: 0,
    rounds: 1,
    orderIndex: index + 1
  }));
};

export function PostureSystemPage() {
  const navigate = useNavigate();
  const [selectedJointId, setSelectedJointId] = useState<string | null>(DEFAULT_JOINT_ID);
  const [view, setView] = useState<"map" | "profile">("map");
  const [launchingProtocol, setLaunchingProtocol] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [rightHeight, setRightHeight] = useState<number | null>(null);
  const userId = useMemo(() => resolveWorkoutUserId(), []);

  const selectedJoint = useMemo(
    () => JOINTS.find((joint) => joint.id === selectedJointId) ?? null,
    [selectedJointId]
  );
  const activeJoint = selectedJoint ?? JOINTS[0] ?? null;
  const activeProtocol = useMemo(
    () => (activeJoint ? protocolForJoint(activeJoint.id) : null),
    [activeJoint]
  );
  const activeScanMedia = useMemo(
    () => (activeJoint ? scanMediaForJoint(activeJoint.id) : scanMediaForJoint("")),
    [activeJoint]
  );
  const activeDysfunction = useMemo(
    () => (activeJoint ? DYSFUNCTIONS.find((item) => item.jointId === activeJoint.id) ?? null : null),
    [activeJoint]
  );
  const activeCompositeScore = useMemo(() => {
    if (!activeJoint) return 0;
    return Math.round((activeJoint.mobility + activeJoint.stability + activeJoint.motorControl) / 3);
  }, [activeJoint]);
  const activeVelocityDelta = useMemo(() => {
    if (!activeJoint) return "0.0 m/s";
    const delta = Math.max(0.2, (100 - activeJoint.mobility) / 40);
    return `${delta.toFixed(1)} m/s`;
  }, [activeJoint]);

  const handleJointClick = (id: string) => {
    setSelectedJointId(id);
    setLaunchError(null);
  };

  const handleLaunchProtocol = async () => {
    if (!activeJoint || launchingProtocol) return;
    setLaunchError(null);
    setLaunchingProtocol(true);
    try {
      const response = await fetchExerciseList({ page: 1, pageSize: 2000 });
      const candidates: LaunchExerciseCandidate[] = response.list
        .map((item) => ({
          id: Number(item.id),
          name: item.name?.trim() || "",
          movementPattern: item.movementPattern?.trim() || ""
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.length > 0);

      if (candidates.length === 0) {
        throw new Error("No exercises available to generate protocol module.");
      }

      const exercises = pickModuleExercisesForJoint(activeJoint.id, candidates);
      if (exercises.length === 0) {
        throw new Error("Failed to assemble protocol exercises.");
      }

      const templateName = `${activeJoint.name} Protocol Module`;
      const created = await createWorkoutTemplate({
        userId,
        templateName,
        templateKind: "module",
        exercises
      });

      navigate(`/module/${created.id}`);
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Failed to launch protocol.");
    } finally {
      setLaunchingProtocol(false);
    }
  };

  useLayoutEffect(() => {
    const target = leftColumnRef.current;
    if (!target) return;
    const update = () => setRightHeight(target.getBoundingClientRect().height);
    update();
    requestAnimationFrame(update);
    const timer = window.setTimeout(update, 0);
    if (typeof ResizeObserver === "undefined") return () => window.clearTimeout(timer);
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const target = leftColumnRef.current;
      if (!target) return;
      setRightHeight(target.getBoundingClientRect().height);
    };
    window.addEventListener("resize", update);
    window.addEventListener("load", update);
    if (document.fonts?.ready) {
      document.fonts.ready.then(update).catch(() => {});
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("load", update);
    };
  }, []);

  return (
    <div className="posture-system flex min-h-screen bg-surface text-on-surface font-body selection:bg-primary-container/30 selection:text-on-primary-container lg:h-screen lg:overflow-hidden">
      <aside className="hidden w-20 flex-col items-center border-r border-outline-variant/20 bg-surface-container-lowest py-8 lg:flex">
        <Activity className="mb-12 h-8 w-8 text-primary-container" />
        <nav className="flex flex-col gap-10">
          <NavItem icon={<Accessibility />} label="Soma" active={view === "map"} onClick={() => setView("map")} />
          <NavItem icon={<LayoutDashboard />} label="Joints" active={view === "profile"} onClick={() => setView("profile")} />
          <NavItem icon={<Hub />} label="Map" />
          <NavItem icon={<Cpu />} label="Proto" />
        </nav>
        <div className="mt-auto flex flex-col items-center gap-6">
          <Settings className="h-6 w-6 cursor-pointer text-on-surface-variant transition-colors hover:text-white" />
          <div className="h-8 w-8 overflow-hidden border border-primary-container/30 grayscale transition-all hover:grayscale-0">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXeRGr79T2SD0aITr3ILMf-6TO1ifvdXlbpmxhL0yexhpdTEbtRgPXoy-N1COE8obN4n78jyV1ui4j5H_Bx7Qfl0C5NlGi2TPWWyYPgk4xW73Ujfe1fajE1XmOd6_Gp5gfRDhERGW-SmCGEQknebAQEhhDhQYhl0nwAOB1qfwSayzIk1aet-cB9kK2yPZpqkI5cBZBDVuQe6aOYixLte_LsY4jRNXkR8nmvsd_XDJ9V8LOxfzQGjTx15280lQPm_gJL195HsQJ"
              alt="User"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </aside>

      <AnimatePresence mode="wait">
        {view === "map" ? (
          <motion.div
            key="map-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-y-auto pb-24 lg:flex-row lg:overflow-hidden lg:pb-0"
          >
            <aside className="hidden w-80 flex-col overflow-y-auto border-r border-outline-variant/10 bg-surface-container-lowest/50 p-6 xl:flex">
              <header className="mb-10">
                <h1 className="font-headline text-xl font-black uppercase tracking-[0.2em] text-primary-container">
                  BIO-COMMAND
                </h1>
                <p className="font-headline text-[10px] uppercase tracking-widest text-on-surface-variant opacity-70">
                  Physical OS v4.2.0
                </p>
              </header>

              <div className="space-y-8">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Global Capability
                    </h2>
                    <Activity className="h-4 w-4 text-primary-container" />
                  </div>
                  <div className="border-l border-primary-container bg-surface-container-low p-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline text-5xl font-black">68</span>
                      <span className="font-headline text-lg text-on-surface-variant">/100</span>
                    </div>
                    <div className="relative mt-4 h-1 w-full bg-surface-container-highest">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "68%" }}
                        className="absolute h-full bg-primary-container shadow-[0_0_10px_#00FF41]"
                      />
                    </div>
                    <p className="mt-4 text-[11px] leading-tight text-on-surface-variant">
                      Performance:{" "}
                      <span className="font-bold uppercase text-secondary-container">Sub-Optimal</span>. Neural drive
                      restricted in primary locomotion hubs.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Active Dysfunction Log
                  </h2>
                  <div className="space-y-3">
                    {DYSFUNCTIONS.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleJointClick(item.jointId)}
                        className={`group cursor-pointer border border-outline-variant/10 bg-surface-container-low p-4 transition-colors ${
                          item.severity === "CRITICAL"
                            ? "hover:border-on-tertiary-container/30"
                            : "hover:border-secondary-container/30"
                        }`}
                      >
                        <div className="absolute right-2 top-2">
                          <span
                            className={`px-1 text-[8px] font-label font-bold ${
                              item.severity === "CRITICAL"
                                ? "bg-on-tertiary-container/10 text-on-tertiary-container"
                                : "bg-secondary-container/10 text-secondary-container"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-headline font-bold uppercase tracking-tight ${
                            item.severity === "CRITICAL"
                              ? "text-on-tertiary-container"
                              : "text-secondary-container"
                          }`}
                        >
                          {JOINTS.find((joint) => joint.id === item.jointId)?.name}
                        </span>
                        <p className="mt-1 text-[13px]">{item.name}</p>
                        <p className="mt-2 text-[9px] font-label uppercase tracking-widest text-on-surface-variant">
                          {item.delta}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="border border-outline-variant/10 bg-surface-container-low p-4">
                    <div className="mb-1 text-[8px] font-headline uppercase text-on-surface-variant">Load Balance</div>
                    <div className="text-lg font-headline font-bold">42/58</div>
                    <div className="mt-1 text-[7px] uppercase text-secondary-container">L/R Disparity</div>
                  </div>
                  <div className="border border-outline-variant/10 bg-surface-container-low p-4">
                    <div className="mb-1 text-[8px] font-headline uppercase text-on-surface-variant">Neural Drive</div>
                    <div className="text-lg font-headline font-bold">840 Hz</div>
                    <div className="mt-1 text-[7px] uppercase text-primary-container">Optimal Signal</div>
                  </div>
                </section>
              </div>
            </aside>

            <section className="border-b border-outline-variant/10 bg-surface-container-lowest/80 p-4 backdrop-blur-sm xl:hidden">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Active Dysfunction Log
                  </h2>
                  <p className="text-[11px] text-on-surface-variant/80">Tap to switch joint focus</p>
                </div>
                <button
                  onClick={() => setView("profile")}
                  className="border border-outline-variant/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary-container"
                >
                  Detailed Profile
                </button>
              </div>
              <div className="space-y-2">
                {DYSFUNCTIONS.map((item) => (
                  <button
                    key={`mobile-${item.id}`}
                    onClick={() => handleJointClick(item.jointId)}
                    className={`w-full border p-3 text-left transition-colors ${
                      item.severity === "CRITICAL"
                        ? "border-on-tertiary-container/30 bg-on-tertiary-container/5"
                        : "border-secondary-container/30 bg-secondary-container/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-headline font-bold uppercase tracking-wide">
                        {JOINTS.find((joint) => joint.id === item.jointId)?.name}
                      </span>
                      <span className="text-[9px] font-label uppercase tracking-[0.2em] text-on-surface-variant">
                        {item.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface/90">{item.name}</p>
                  </button>
                ))}
              </div>
            </section>

            <main className="relative flex min-h-[56vh] flex-1 items-center justify-center overflow-hidden bg-surface-container-lowest lg:min-h-0 lg:border-r lg:border-outline-variant/10">
              <div className="grid-overlay pointer-events-none absolute inset-0" />
              <div className="relative flex h-full w-full items-center justify-center px-2 py-3 sm:px-4 sm:py-4 lg:px-0">
                <PostureModelCanvas selectedJointId={selectedJointId} onSelectJoint={handleJointClick} />
              </div>

              <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between rounded-md border border-outline-variant/30 bg-surface/70 px-3 py-2 backdrop-blur-sm sm:hidden">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.25em] text-on-surface-variant">Node</div>
                  <div className="text-xs font-bold">NODE-8829-SOMA</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.25em] text-primary-container">Status</div>
                  <div className="text-xs font-bold">CALIBRATING</div>
                </div>
              </div>

              <div className="absolute left-8 top-8 hidden font-headline sm:block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
                  Node Reference
                </div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                  NODE-8829-SOMA
                </div>
              </div>
              <div className="absolute right-8 top-8 hidden text-right font-headline sm:block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-primary-container">
                  System Status
                </div>
                <div className="text-xl font-bold">CALIBRATION ACTIVE</div>
              </div>
              <div className="absolute bottom-4 left-3 right-3 z-20 flex gap-2 sm:bottom-8 sm:left-auto sm:right-8 sm:w-auto sm:gap-4">
                <button className="flex-1 border border-outline-variant/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-surface-container-high sm:flex-none sm:px-4">
                  Capture Baseline
                </button>
                <button
                  onClick={() => setView("profile")}
                  className="flex-1 border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary-container sm:flex-none sm:px-4"
                >
                  View Detailed Profile
                </button>
              </div>
            </main>

            <section className="space-y-5 border-t border-outline-variant/10 bg-surface-container-lowest/70 p-4 lg:hidden">
              {activeJoint ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div
                        className={`text-[10px] font-black uppercase tracking-widest ${
                          activeJoint.status === "CRITICAL"
                            ? "text-on-tertiary-container"
                            : "text-secondary-container"
                        }`}
                      >
                        {activeJoint.status === "OPTIMAL" ? "Optimal Focus" : "Target Focus"}
                      </div>
                      <div className="text-2xl font-headline font-bold uppercase tracking-tight">{activeJoint.name}</div>
                    </div>
                    {activeJoint.status !== "OPTIMAL" && (
                      <ShieldAlert className="h-7 w-7 shrink-0 text-on-tertiary-container" />
                    )}
                  </div>

                  <div className="space-y-4">
                    <MetricBar
                      label="Mobility (ROM)"
                      value={activeJoint.mobility}
                      color={activeJoint.status === "CRITICAL" ? "red" : "green"}
                    />
                    <MetricBar label="Stability Index" value={activeJoint.stability} color="green" />
                    <MetricBar label="Motor Control" value={activeJoint.motorControl} color="green" />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="bg-surface-container-low p-3">
                      <div className="text-[9px] font-headline uppercase text-on-surface-variant">Symmetry Index</div>
                      <div className="mt-1 text-lg font-headline">{(activeCompositeScore / 100).toFixed(2)}</div>
                    </div>
                    <div className="bg-surface-container-low p-3">
                      <div className="text-[9px] font-headline uppercase text-on-surface-variant">Velocity Delta</div>
                      <div className="mt-1 text-lg font-headline">{activeVelocityDelta}</div>
                    </div>
                  </div>

                  <div className="border border-outline-variant/20 bg-surface-container-low p-3">
                    <div className="text-[9px] font-headline uppercase text-on-surface-variant">Active Finding</div>
                    <div className="mt-1 text-sm font-semibold">
                      {activeDysfunction?.name || "No major dysfunction detected"}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {activeDysfunction?.note || activeProtocol?.targetLabel || "Target: Selected Joint"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-on-surface-variant opacity-70">
                  <Info className="mb-3 h-10 w-10" />
                  <p className="font-headline text-xs uppercase tracking-widest">
                    Select a joint node to view telemetry
                  </p>
                </div>
              )}
            </section>

            <aside className="hidden w-[340px] flex-col overflow-y-auto bg-surface-container-lowest/50 p-6 lg:flex">
              {activeJoint ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-10"
                >
                  <section>
                    <div className="mb-8 flex items-center justify-between">
                      <div className="font-headline">
                        <div
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            activeJoint.status === "CRITICAL"
                              ? "text-on-tertiary-container"
                              : "text-secondary-container"
                          }`}
                        >
                          {activeJoint.status === "OPTIMAL" ? "Optimal Focus" : "Target Focus"}
                        </div>
                        <div className="text-3xl font-bold uppercase tracking-tight">{activeJoint.name}</div>
                      </div>
                      {activeJoint.status !== "OPTIMAL" && (
                        <ShieldAlert className="h-8 w-8 text-on-tertiary-container" />
                      )}
                    </div>

                    <div className="space-y-8">
                      <MetricBar
                        label="Mobility (ROM)"
                        value={activeJoint.mobility}
                        color={activeJoint.status === "CRITICAL" ? "red" : "green"}
                      />
                      <MetricBar label="Stability Index" value={activeJoint.stability} color="green" />
                      <MetricBar label="Motor Control" value={activeJoint.motorControl} color="green" />
                    </div>

                    <div className="mt-12">
                      <button
                        onClick={() => setView("profile")}
                        className="w-full bg-primary-container py-5 font-headline text-[11px] font-bold uppercase tracking-[0.2em] text-on-primary-container shadow-[0_0_20px_rgba(0,255,65,0.2)] transition-all hover:brightness-110 active:scale-95"
                      >
                        Initiate Reset Protocol
                      </button>
                      <p className="mt-4 text-center text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">
                        Est. Duration: {activeProtocol?.duration || "12 MIN"}
                      </p>
                    </div>
                  </section>

                  <section className="border-t border-outline-variant/10 pt-8">
                    <h3 className="mb-6 font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Comparative Analytics
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-surface-container-low p-4">
                        <div className="flex items-end justify-between">
                          <div className="text-[9px] font-headline uppercase text-on-surface-variant">Symmetry Index</div>
                          <div className="text-lg font-headline">{(activeCompositeScore / 100).toFixed(2)}</div>
                        </div>
                        <div className="mt-2 h-1 w-full overflow-hidden bg-surface-container-highest">
                          <div className="h-full bg-secondary-container" style={{ width: `${activeCompositeScore}%` }} />
                        </div>
                      </div>
                      <div className="bg-surface-container-low p-4">
                        <div className="flex items-end justify-between">
                          <div className="text-[9px] font-headline uppercase text-on-surface-variant">Velocity Delta</div>
                          <div className="text-lg font-headline">{activeVelocityDelta}</div>
                        </div>
                        <div className="mt-2 h-1 w-full overflow-hidden bg-surface-container-highest">
                          <div
                            className="h-full bg-primary-container"
                            style={{ width: `${Math.max(20, activeJoint.motorControl)}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-surface-container-low p-4">
                        <div className="text-[9px] font-headline uppercase text-on-surface-variant">Active Finding</div>
                        <div className="mt-1 text-sm font-semibold">
                          {activeDysfunction?.name || "No major dysfunction detected"}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
                          {activeDysfunction?.note || activeProtocol?.targetLabel || "Target: Selected Joint"}
                        </div>
                      </div>
                    </div>
                  </section>
                </motion.div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-on-surface-variant opacity-50">
                  <Info className="mb-4 h-12 w-12" />
                  <p className="font-headline text-xs uppercase tracking-widest">
                    Select a joint node to view telemetry
                  </p>
                </div>
              )}
            </aside>
          </motion.div>
        ) : (
          <motion.div
            key="profile-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-32 lg:p-12 lg:pb-12"
          >
            <div className="mx-auto w-full max-w-[1600px]">
              <div className="mb-8 flex flex-col justify-between gap-5 border-b border-outline-variant/20 pb-6 lg:mb-12 lg:flex-row lg:items-end lg:gap-0 lg:pb-8">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="bg-primary-container/10 px-2 py-1 text-xs font-label uppercase tracking-[0.3em] text-primary-container">
                      Joint Analysis // {activeJoint ? activeJoint.id.toUpperCase() : "N/A"}
                    </span>
                  </div>
                  <h2 className="font-headline text-3xl font-black uppercase tracking-tight sm:text-4xl lg:text-7xl">
                    {activeJoint ? `${activeJoint.name} Capability Profile` : "Joint Capability Profile"}
                  </h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-left sm:text-right lg:mt-0">
                  <div>
                    <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                      Active Scan
                    </p>
                    <p className="font-headline text-xl font-bold text-primary-container">
                      {activeProtocol?.scanCode || "JOINT_SCAN_GENERIC"}
                    </p>
                  </div>
                  <div className="border-l border-outline-variant/30 pl-4">
                    <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                      Global Status
                    </p>
                    <p
                      className={`font-headline text-xl font-bold uppercase ${
                        activeJoint?.status === "CRITICAL"
                          ? "text-on-tertiary-container"
                          : activeJoint?.status === "CAUTIONARY"
                          ? "text-secondary-container"
                          : "text-primary-container"
                      }`}
                    >
                      {activeJoint ? statusLabel(activeJoint.status) : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_2fr]">
                <div ref={leftColumnRef} className="flex flex-col gap-6">
                  <h3 className="mb-2 flex items-center gap-3 font-headline text-lg font-bold uppercase tracking-widest">
                    <span className="h-0.5 w-4 bg-primary-container" />
                    Capability Metrics
                  </h3>
                  <MetricCard
                    label="Mobility (ROM)"
                    value={activeJoint?.mobility ?? 0}
                    status={metricStatusLabel(activeJoint?.status ?? "CAUTIONARY")}
                    note={activeDysfunction?.delta ? activeDysfunction.delta + " DEFICIT" : undefined}
                    color={metricColor(activeJoint?.status ?? "CAUTIONARY")}
                  />
                  <MetricCard
                    label="Stability (Static)"
                    value={activeJoint?.stability ?? 0}
                    status={metricStatusLabel(activeJoint?.status ?? "CAUTIONARY")}
                    color={metricColor(activeJoint?.status ?? "CAUTIONARY")}
                  />
                  <MetricCard
                    label="Neural Control"
                    value={activeJoint?.motorControl ?? 0}
                    status={metricStatusLabel(activeJoint?.status ?? "CAUTIONARY")}
                    color={metricColor(activeJoint?.status ?? "CAUTIONARY")}
                  />
                </div>

                <div
                  className="relative overflow-hidden border border-outline-variant/10 bg-surface-container-low box-border"
                  style={{
                    height: `clamp(380px, 56vh, ${Math.round(rightHeight ?? 640)}px)`,
                    minHeight: "380px",
                    maxHeight: `${Math.round(rightHeight ?? 640)}px`
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_25%,rgba(0,255,65,0.08),transparent_45%),radial-gradient(circle_at_70%_75%,rgba(255,191,0,0.08),transparent_45%),linear-gradient(180deg,#0b1118,#0a0f16)]" />
                  <PostureModelCanvas selectedJointId={selectedJointId} onSelectJoint={handleJointClick} />
                  <div className="absolute left-4 top-4 z-20 lg:left-8 lg:top-8">
                    <h3 className="mb-2 font-headline text-2xl font-black uppercase tracking-tight text-primary-container sm:text-3xl lg:text-5xl">
                      {activeProtocol?.patternHeadline || "Movement Pattern Review"}
                    </h3>
                    <div className="flex flex-wrap gap-2 lg:gap-4">
                      <span className="bg-on-tertiary-container px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white lg:px-3 lg:text-[10px]">
                        {activeProtocol?.targetLabel || "Target: Selected Joint"}
                      </span>
                      <span className="border border-white/10 bg-black/60 px-2 py-1 text-[9px] font-mono tracking-wider text-on-surface lg:px-3 lg:text-[10px] lg:tracking-widest">
                        {activeProtocol?.coordinate || "COORD: N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <section className="relative overflow-hidden border border-primary-container/20 bg-surface-container-highest p-4 sm:p-6 lg:p-12">
                <div className="mb-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <span className="animate-pulse text-xs font-label uppercase tracking-[0.4em] text-primary-container">
                        Neural Path Optimized
                      </span>
                    </div>
                    <h3 className="font-headline text-3xl font-black uppercase tracking-tight lg:text-4xl">
                      Active Protocol: {activeProtocol?.protocolName || "Restoration-G"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-4 border border-outline-variant/30 bg-surface-container-low px-4 py-3 sm:gap-8 sm:px-8 sm:py-4">
                    <ProtocolStat label="Duration" value={activeProtocol?.duration || "12 MIN"} />
                    <ProtocolStat
                      label="Intensity"
                      value={activeProtocol?.intensity || "MOD"}
                      color={activeJoint?.status === "CRITICAL" ? "red" : "amber"}
                    />
                    <ProtocolStat label="Target" value={activeProtocol?.target || "CONTROL"} />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-8 lg:gap-12 lg:flex-row">
                  <div className="group relative aspect-video w-full cursor-pointer overflow-hidden border-2 border-outline-variant/30 bg-surface-variant lg:w-1/2">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeNNXMOhNYB0LelAWSW6diJzl3629RnJRNFz7G2ik9Q5wLBlrPslEaWk2CgTN6lx3NZmplOs0DKoIHo8TX8Sr3vFQreUUf0tMJOIS5eYn87hUsq2ah984s4ANSRGVellpoiElgDDOxhKvS-761Cl8jf74FC59JbBVHg2cP-ma9ti5OAeKKhfcSJ2OkxfKcJUa7UYdyyZLX3VzaW7acW6Nit23Q2tVcqcqRp8h-AKZJFkvZN7vJTXZbefiqKh8TH8wqjF0iXeu6"
                      alt="Exercise"
                      className="h-full w-full object-cover grayscale brightness-75 transition-all duration-700 group-hover:grayscale-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all group-hover:bg-black/20">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/50 backdrop-blur-sm transition-transform group-hover:scale-110">
                        <Play className="h-10 w-10 fill-white text-white" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 bg-primary-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-primary-container">
                      {activeProtocol?.exerciseLabel || "Exercise 01/03: Controlled Mobility Drill"}
                    </div>
                  </div>

                  <div className="w-full lg:w-1/2">
                    <h4 className="mb-4 font-headline text-xl font-bold uppercase text-primary-container sm:text-2xl">
                      Functional Reset Instructions
                    </h4>
                    <p className="mb-6 leading-relaxed text-on-surface-variant">
                      {activeProtocol?.instruction ||
                        "Move through pain-free range while maintaining neutral alignment and consistent tempo."}
                    </p>
                    <div className="mb-8 grid grid-cols-2 gap-4">
                      <div className="border border-outline-variant/20 bg-surface-container-low p-4">
                        <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                          Repetitions
                        </p>
                        <p className="font-headline text-2xl font-black">
                          {activeProtocol?.repetitions || "10-12 REPS"}
                        </p>
                      </div>
                      <div className="border border-outline-variant/20 bg-surface-container-low p-4">
                        <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                          Tempo Protocol
                        </p>
                        <p className="font-headline text-2xl font-black tracking-widest">
                          {activeProtocol?.tempo || "2-2-2"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleLaunchProtocol}
                      disabled={launchingProtocol || !activeJoint}
                      className="flex w-full items-center justify-center gap-3 bg-primary-container py-5 font-headline text-sm font-black uppercase tracking-[0.2em] text-on-primary-container shadow-[0_0_40px_rgba(0,255,65,0.2)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:gap-4 sm:py-6 sm:text-xl sm:tracking-[0.4em]"
                    >
                      {launchingProtocol ? "Generating Module..." : "Launch Protocol"}
                      <Zap className="h-6 w-6" />
                    </button>
                    {launchError ? (
                      <p className="mt-3 text-xs text-on-tertiary-container">{launchError}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <footer className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-outline-variant/10 py-8 md:flex-row">
                <div className="flex items-center gap-4">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                    System Status: Bio-Link Synchronized // Latency 14ms
                  </p>
                </div>
                <div className="flex gap-8 text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  <button onClick={() => setView("map")} className="transition-colors hover:text-primary-container">
                    Return to Map
                  </button>
                  <button className="transition-colors hover:text-primary-container">Export Raw Data</button>
                  <button className="transition-colors hover:text-primary-container">Share Diagnosis</button>
                </div>
              </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-6 left-1/2 z-50 flex h-16 w-[92%] max-w-md -translate-x-1/2 items-center justify-around border border-primary-container/20 bg-surface-container-highest/80 px-4 backdrop-blur-xl shadow-[0_0_20px_rgba(0,255,65,0.1)] lg:hidden">
        <Accessibility className={view === "map" ? "text-primary-container" : "text-on-surface/50"} onClick={() => setView("map")} />
        <LayoutDashboard className={view === "profile" ? "text-primary-container" : "text-on-surface/50"} onClick={() => setView("profile")} />
        <Hub className="text-on-surface/50" />
        <Cpu className="text-on-surface/50" />
      </nav>
    </div>
  );
}

function PostureModelCanvas({
  selectedJointId,
  onSelectJoint
}: {
  selectedJointId: string | null;
  onSelectJoint: (id: string) => void;
}) {
  const modelRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    lastPointerRef.current = null;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !modelRef.current || !lastPointerRef.current) return;
    const dx = event.clientX - lastPointerRef.current.x;
    modelRef.current.rotation.y += dx * 0.005;
    modelRef.current.rotation.x = 0;
    modelRef.current.rotation.z = 0;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  };

  return (
    <div
      className="absolute inset-0"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <Canvas
        camera={{ position: [0, 0.2, 5.2], fov: 30 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 4]} intensity={0.9} color="#9CFFD6" />
        <spotLight position={[-3, 3, 2]} intensity={0.8} angle={0.4} penumbra={0.8} color="#00ff41" />
        <spotLight position={[2, -3, -2]} intensity={0.5} angle={0.4} penumbra={0.8} color="#ffbf00" />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <PostureModel selectedJointId={selectedJointId} modelRef={modelRef} onSelectJoint={onSelectJoint} />
          </Bounds>
        </Suspense>
      </Canvas>
    </div>
  );
}

function PostureModel({
  selectedJointId,
  modelRef,
  onSelectJoint
}: {
  selectedJointId: string | null;
  modelRef: React.RefObject<THREE.Group>;
  onSelectJoint: (id: string) => void;
}) {
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const highlightedRef = useRef<THREE.Mesh[]>([]);
  const [modelOffset, setModelOffset] = useState<THREE.Vector3 | null>(null);
  const [primaryScene, setPrimaryScene] = useState<THREE.Object3D | null>(null);
  const [mirroredScene, setMirroredScene] = useState<THREE.Object3D | null>(null);
  const { scene } = useGLTF("/models/open3d-skeleton.glb");
  const jointMarkers = useMemo(() => {
    // Only render marker nodes for risky joints (dysfunctions/warnings),
    // so the map focuses attention instead of showing full-body noise.
    const riskyJoints = (() => {
      const ordered = DYSFUNCTIONS.map((item) => JOINTS.find((joint) => joint.id === item.jointId)).filter(
        Boolean
      ) as JointData[];
      const deduped = ordered.filter(
        (joint, index, list) => list.findIndex((item) => item.id === joint.id) === index
      );
      if (deduped.length > 0) return deduped;
      return JOINTS.filter((joint) => joint.status !== "OPTIMAL");
    })();

    const offsetMap: Record<string, [number, number, number]> = {
      neck: [0.2, 0.16, 0.34],
      "lumbar-spine": [0.27, 0.1, 0.34],
      pelvis: [0.28, 0.08, 0.34],
      "r-hip": [0.26, 0.1, 0.35],
      "l-ankle": [-0.22, -0.02, 0.32],
      "r-ankle": [0.22, -0.02, 0.32]
    };

    const positionMap: Record<string, [number, number, number]> = {
      neck: [0, 1.28, -0.04],
      "lumbar-spine": [0, 0.42, -0.05],
      pelvis: [0, 0.18, -0.05],
      "r-hip": [0.33, 0.18, -0.05],
      "l-ankle": [-0.25, -0.95, -0.05],
      "r-ankle": [0.25, -0.95, -0.05]
    };

    return riskyJoints.map((joint) => ({
      id: joint.id,
      label: joint.name,
      status: joint.status,
      position: positionMap[joint.id] ?? ([0, 0, 0] as [number, number, number]),
      offset: offsetMap[joint.id] ?? ([0.25, 0.1, 0.3] as [number, number, number])
    }));
  }, []);

  useEffect(() => {
    const base = scene.clone(true);
    const baseBox = new THREE.Box3().setFromObject(base);
    const baseCenter = new THREE.Vector3();
    const baseSize = new THREE.Vector3();
    baseBox.getCenter(baseCenter);
    baseBox.getSize(baseSize);
    const maxDim = Math.max(baseSize.x, baseSize.y, baseSize.z);
    const scale = maxDim > 0 ? 4.2 / maxDim : 1;

    base.position.sub(baseCenter);
    base.scale.setScalar(scale);

    base.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        mesh.material = (mesh.material as THREE.Material).clone();
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive = mat.emissive ?? new THREE.Color("#000000");
        mesh.userData.baseEmissive = mat.emissive.clone();
        mesh.userData.baseColor = mat.color.clone();
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        mesh.userData.sideTag = worldPos.x >= 0 ? "R" : "L";
      }
    });

    const mirror = base.clone(true);
    mirror.scale.x *= -1;

    mirror.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        mesh.material = (mesh.material as THREE.Material).clone();
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive = mat.emissive ?? new THREE.Color("#000000");
        mesh.userData.baseEmissive = mat.emissive.clone();
        mesh.userData.baseColor = mat.color.clone();
      }
    });

    const tagSide = (object: THREE.Object3D, side: "L" | "R") => {
      object.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mesh = obj as THREE.Mesh;
          mesh.userData.sideTag = side;
        }
      });
    };

    tagSide(base, "L");
    tagSide(mirror, "R");

    const combo = new THREE.Group();
    combo.add(base.clone(true));
    combo.add(mirror.clone(true));
    const comboBox = new THREE.Box3().setFromObject(combo);
    const comboCenter = new THREE.Vector3();
    comboBox.getCenter(comboCenter);

    setPrimaryScene(base);
    setMirroredScene(mirror);
    setModelOffset(comboCenter.multiplyScalar(-1));
  }, [scene]);

  const keywordMap: Record<string, string[]> = {
    head: ["head", "skull", "cranium", "mandible"],
    neck: ["neck", "atlas", "axis", "cervical_top"],
    "c-spine": ["cervical", "vertebra_c", "cspine", "c_spine"],
    "t-spine": ["thoracic", "vertebra_t", "tspine", "t_spine", "rib"],
    "lumbar-spine": ["lumbar", "vertebra_l", "lspine", "l_spine", "sacrum"],
    pelvis: ["pelvis", "ilium", "acetabul", "hip_center", "sacrum"],
    "l-shoulder": ["shoulder", "scapula", "scap", "clavicle", "humerus", "deltoid"],
    "r-shoulder": ["shoulder", "scapula", "scap", "clavicle", "humerus", "deltoid"],
    "l-elbow": ["elbow", "ulna", "radius", "olecranon", "humerus_distal"],
    "r-elbow": ["elbow", "ulna", "radius", "olecranon", "humerus_distal"],
    "l-wrist": ["wrist", "carpal", "metacarpal", "hand", "radius_distal"],
    "r-wrist": ["wrist", "carpal", "metacarpal", "hand", "radius_distal"],
    "l-hip": ["hip", "femur", "femur_prox", "glute", "acetabul"],
    "r-hip": ["hip", "femur", "femur_prox", "glute", "acetabul"],
    "l-knee": ["knee", "patella", "tibia", "fibula", "femur_distal"],
    "r-knee": ["knee", "patella", "tibia", "fibula", "femur_distal"],
    "l-ankle": ["ankle", "talus", "calcaneus", "foot", "metatarsal", "malleolus"],
    "r-ankle": ["ankle", "talus", "calcaneus", "foot", "metatarsal", "malleolus"]
  };

  const isSideMatch = (jointId: string, sideTag?: "L" | "R") => {
    if (!sideTag) return true;
    if (jointId.startsWith("l-")) return sideTag === "L";
    if (jointId.startsWith("r-")) return sideTag === "R";
    return true;
  };

  const resolveJointIdFromMesh = (mesh: THREE.Mesh) => {
    const name = mesh.name.toLowerCase();
    const sideTag = mesh.userData.sideTag as "L" | "R" | undefined;

    let bestJointId: string | null = null;
    let bestScore = 0;
    let bestSideMatch = false;

    Object.entries(keywordMap).forEach(([jointId, keywords]) => {
      const score = keywords.reduce((count, keyword) => count + (name.includes(keyword) ? 1 : 0), 0);
      if (score <= 0) return;

      const sideMatch = isSideMatch(jointId, sideTag);
      const isBetterScore = score > bestScore;
      const isBetterSide =
        score === bestScore && sideMatch && !bestSideMatch;

      if (!bestJointId || isBetterScore || isBetterSide) {
        bestJointId = jointId;
        bestScore = score;
        bestSideMatch = sideMatch;
      }
    });

    return bestJointId;
  };

  const applyHighlight = (mesh: THREE.Mesh, color: string, intensity: number) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = intensity;
  };

  const resetMesh = (mesh: THREE.Mesh) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive = mesh.userData.baseEmissive?.clone?.() ?? new THREE.Color("#000000");
    mat.emissiveIntensity = 0.1;
  };

  const restoreMeshVisual = (mesh: THREE.Mesh) => {
    if (highlightedRef.current.includes(mesh)) {
      applyHighlight(mesh, "#4da3ff", 1.2);
      return;
    }
    resetMesh(mesh);
  };

  useEffect(() => {
    highlightedRef.current.forEach((mesh) => resetMesh(mesh));
    highlightedRef.current = [];

    if (!selectedJointId) return;
    const keywords = keywordMap[selectedJointId] ?? [];
    if (keywords.length === 0) return;

    if (!primaryScene || !mirroredScene) return;
    const applyFor = (object: THREE.Object3D) => {
      object.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mesh = obj as THREE.Mesh;
          const name = mesh.name.toLowerCase();
          if (keywords.some((keyword) => name.includes(keyword))) {
            if (!isSideMatch(selectedJointId, mesh.userData.sideTag as "L" | "R" | undefined)) return;
            applyHighlight(mesh, "#4da3ff", 1.2);
            highlightedRef.current.push(mesh);
          }
        }
      });
    };

    if (selectedJointId?.startsWith("l-")) {
      applyFor(primaryScene);
      return;
    }

    if (selectedJointId?.startsWith("r-")) {
      applyFor(mirroredScene);
      return;
    }

    applyFor(primaryScene);
    applyFor(mirroredScene);
  }, [primaryScene, mirroredScene, selectedJointId]);

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const mesh = event.object as THREE.Mesh;
    if (!(mesh instanceof THREE.Mesh)) return;

    const resolvedJointId = resolveJointIdFromMesh(mesh);
    if (hoveredRef.current && hoveredRef.current !== mesh) {
      restoreMeshVisual(hoveredRef.current);
    }

    if (!resolvedJointId) {
      hoveredRef.current = null;
      document.body.style.cursor = "default";
      return;
    }

    hoveredRef.current = mesh;
    document.body.style.cursor = "pointer";
    applyHighlight(mesh, "#8fd0ff", 1.4);
  };

  const handlePointerOut = () => {
    if (hoveredRef.current) {
      restoreMeshVisual(hoveredRef.current);
      hoveredRef.current = null;
    }
    document.body.style.cursor = "default";
  };

  const handleModelPointerDown = (event: ThreeEvent<PointerEvent>) => {
    const mesh = event.object as THREE.Mesh;
    if (!(mesh instanceof THREE.Mesh)) return;

    const resolvedJointId = resolveJointIdFromMesh(mesh);
    if (!resolvedJointId) return;

    event.stopPropagation();
    onSelectJoint(resolvedJointId);
  };

  return (
    <group
      ref={modelRef}
      position={
        modelOffset ? [modelOffset.x, modelOffset.y, modelOffset.z] : [0, 0, 0]
      }
      scale={1}
      onPointerDown={handleModelPointerDown}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <group position={[0, 0, 0]}>
        {primaryScene && <primitive object={primaryScene} />}
      </group>
      <group position={[0, 0, 0]}>
        {mirroredScene && <primitive object={mirroredScene} />}
      </group>
      {jointMarkers.map((marker) => {
        const isSelected = selectedJointId === marker.id;
        const color =
          marker.status === "CRITICAL"
            ? "#ff335a"
            : marker.status === "CAUTIONARY"
            ? "#ffbf00"
            : "#4cff7a";
        const lineEnd: [number, number, number] = [
          marker.position[0] + marker.offset[0],
          marker.position[1] + marker.offset[1],
          marker.position[2] + marker.offset[2]
        ];
        const offsetLength = Math.hypot(marker.offset[0], marker.offset[1], marker.offset[2]) || 1;
        const labelPos: [number, number, number] = [
          lineEnd[0] + (marker.offset[0] / offsetLength) * 0.08,
          lineEnd[1] + (marker.offset[1] / offsetLength) * 0.08,
          lineEnd[2] + (marker.offset[2] / offsetLength) * 0.08
        ];
        return (
          <group key={marker.id} position={marker.position}>
            <Line
              points={[
                [0, 0, 0],
                [lineEnd[0] - marker.position[0], lineEnd[1] - marker.position[1], lineEnd[2] - marker.position[2]]
              ]}
              color={color}
              lineWidth={1}
              transparent
              opacity={0.7}
            />
            <mesh
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectJoint(marker.id);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "default";
              }}
            >
              <sphereGeometry args={[isSelected ? 0.045 : 0.035, 24, 24]} />
              <meshStandardMaterial
                color={isSelected ? "#ffffff" : color}
                emissive={isSelected ? "#ffffff" : color}
                emissiveIntensity={isSelected ? 1.4 : 0.9}
              />
            </mesh>
            <mesh
              position={[
                lineEnd[0] - marker.position[0],
                lineEnd[1] - marker.position[1],
                lineEnd[2] - marker.position[2]
              ]}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectJoint(marker.id);
              }}
            >
              <sphereGeometry args={[0.022, 20, 20]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
            </mesh>
            <mesh
              position={[
                lineEnd[0] - marker.position[0],
                lineEnd[1] - marker.position[1],
                lineEnd[2] - marker.position[2]
              ]}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectJoint(marker.id);
              }}
            >
              <sphereGeometry args={[0.065, 16, 16]} />
              <meshStandardMaterial transparent opacity={0} />
            </mesh>
            {isSelected && (
              <Html
                center
                distanceFactor={11}
                position={[
                  labelPos[0] - marker.position[0],
                  labelPos[1] - marker.position[1],
                  labelPos[2] - marker.position[2]
                ]}
                style={{ pointerEvents: "none" }}
              >
                <div className="rounded-full border border-primary-container/40 bg-black/70 px-3 py-1 text-[10px] font-label uppercase tracking-widest text-primary-container shadow-[0_0_20px_rgba(0,255,65,0.15)]">
                  {marker.label}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

useGLTF.preload("/models/open3d-skeleton.glb");

function NavItem({
  icon,
  label,
  active = false,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col items-center justify-center transition-all ${
        active ? "text-primary-container" : "text-on-surface/50 hover:text-primary-container"
      }`}
    >
      {active && <div className="absolute -left-10 h-8 w-1 bg-primary-container shadow-[0_0_10px_#00FF41]" />}
      <div className="h-6 w-6">{icon}</div>
      <span className="absolute left-16 hidden whitespace-nowrap border border-outline-variant bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-widest group-hover:block">
        {label}
      </span>
    </div>
  );
}

function Hotspot({
  joint,
  isSelected,
  onClick
}: {
  joint: JointData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const glowClass =
    joint.status === "CRITICAL"
      ? "hotspot-glow-red border-on-tertiary-container"
      : joint.status === "CAUTIONARY"
      ? "hotspot-glow-amber border-secondary-container"
      : "hotspot-glow-green border-primary-container";

  const dotClass =
    joint.status === "CRITICAL"
      ? "bg-on-tertiary-container"
      : joint.status === "CAUTIONARY"
      ? "bg-secondary-container"
      : "bg-primary-container";

  return (
    <div className="absolute" style={{ top: joint.position.top, left: joint.position.left }}>
      <div
        onClick={onClick}
        className={`group relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border bg-surface/50 transition-all hover:scale-125 ${glowClass} ${
          isSelected ? "scale-125" : ""
        }`}
      >
        <div className={`h-2 w-2 rounded-full ${dotClass} ${joint.status === "CRITICAL" ? "animate-ping" : ""}`} />
        {joint.status === "CRITICAL" && <div className={`absolute h-2 w-2 rounded-full ${dotClass}`} />}
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap border border-outline-variant bg-surface-container-high px-2 py-1 text-[8px] font-headline transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {joint.id.toUpperCase()}: {joint.status}
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: "red" | "green" }) {
  const barColor = color === "red" ? "bg-on-tertiary-container" : "bg-primary-container";
  const textColor = color === "red" ? "text-on-tertiary-container" : "text-primary-container";

  return (
    <div>
      <div className="mb-3 flex justify-between text-[10px] font-headline uppercase text-on-surface-variant">
        <span>{label}</span>
        <span className={textColor}>{value}%</span>
      </div>
      <div className="grid h-2 grid-cols-10 gap-1">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className={`h-full ${index < Math.round(value / 10) ? barColor : "bg-surface-container-highest"}`}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
  note,
  color
}: {
  label: string;
  value: number;
  status: string;
  note?: string;
  color: "red" | "amber";
}) {
  const accentColor = color === "red" ? "border-on-tertiary-container" : "border-secondary-container";
  const textColor = color === "red" ? "text-on-tertiary-container" : "text-secondary-container";
  const barColor = color === "red" ? "bg-on-tertiary-container" : "bg-secondary-container";

  return (
    <div className={`group relative overflow-hidden border-l-4 bg-surface-container-low p-5 sm:p-8 ${accentColor}`}>
      <div className="mb-6 flex items-start justify-between">
        <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{label}</span>
        <span className={`font-headline text-3xl font-black sm:text-5xl ${textColor}`}>
          {value}
          <span className="text-sm font-normal sm:text-base">%</span>
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-variant">
        <div className={`h-full ${barColor}`} style={{ width: `${value}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-label font-black uppercase tracking-tighter ${textColor}`}>
          Status: {status}
        </p>
        {note && <span className="text-[10px] font-mono text-on-surface-variant">{note}</span>}
      </div>
    </div>
  );
}

function ProtocolStat({
  label,
  value,
  color = "white"
}: {
  label: string;
  value: string;
  color?: "white" | "amber";
}) {
  return (
    <div
      className={`min-w-[84px] text-center ${label !== "Duration" ? "sm:border-l sm:border-outline-variant/30 sm:pl-8" : ""}`}
    >
      <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={`font-headline text-xl font-bold ${color === "amber" ? "text-secondary-container" : ""}`}>
        {value}
      </p>
    </div>
  );
}
