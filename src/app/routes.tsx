import { createBrowserRouter } from "react-router";
import { AppShell } from "../shared/components/AppShell";
import { SystemSelection } from "../modules/library/SystemSelection";
import { Library } from "../modules/library/Library";
import { ExerciseDetail } from "../modules/library/ExerciseDetail";
import { WorkoutPlayerPage } from "../modules/training/WorkoutPlayerPage";
import { WorkoutSetupPage } from "../modules/training/WorkoutSetupPage";
import { WorkoutBuilderPage } from "../modules/training/WorkoutBuilderPage";
import { TemplateLibraryPage } from "../modules/training/TemplateLibraryPage";
import { WorkoutStyleSelectionPage } from "../modules/training/WorkoutStyleSelectionPage";
import { QuickModuleHubPage } from "../modules/training/QuickModuleHubPage";
import { ModuleDetailPage } from "../modules/training/ModuleDetailPage";
import { ProgramPlannerPage } from "../modules/training/ProgramPlannerPage";
import { SharedTemplatePage } from "../modules/training/SharedTemplatePage";
import { AthleteProfilePage } from "../modules/profile/AthleteProfilePage";
import { HomePage } from "../modules/home/HomePage";
import { SomaticArchitectLandingPage } from "../modules/home/SomaticArchitectLandingPage";
import { WorkoutSummaryPage } from "../modules/training/WorkoutSummaryPage";
import { PostureSystemPage } from "../modules/posture/PostureSystemPage";
import {
  SystemActiveAssessmentPage,
  SystemAssessmentIntroPage,
  SystemAssessmentListPage,
  SystemEntryPage,
  SystemGoalEntryPage,
  SystemHistoryPage,
  SystemLoginPage,
  SystemOnboardingPage,
  SystemSummaryPage
} from "../modules/system/SystemFlowPages";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        index: true,
        Component: SomaticArchitectLandingPage,
      },
      {
        path: "systems",
        Component: SystemSelection,
      },
      {
        path: "library/:systemId",
        Component: Library,
      },
      {
        path: "library",
        Component: Library,
      },
      {
        path: "exercise/:id",
        Component: ExerciseDetail,
      },
      {
        path: "workout",
        Component: WorkoutPlayerPage,
      },
      {
        path: "workout-summary",
        Component: WorkoutSummaryPage,
      },
      {
        path: "modules",
        Component: QuickModuleHubPage,
      },
      {
        path: "module/:id",
        Component: ModuleDetailPage,
      },
      {
        path: "athlete",
        Component: AthleteProfilePage,
      },
      {
        path: "training",
        Component: WorkoutSetupPage,
      },
      {
        path: "posture",
        Component: PostureSystemPage,
      },
      {
        path: "workout-builder",
        Component: WorkoutBuilderPage,
      },
      {
        path: "workout-style",
        Component: WorkoutStyleSelectionPage,
      },
      {
        path: "templates",
        Component: TemplateLibraryPage,
      },
      {
        path: "programs",
        Component: ProgramPlannerPage,
      },
      {
        path: "share/template/:shareCode",
        Component: SharedTemplatePage,
      },
      {
        path: "s/:shareCode",
        Component: SharedTemplatePage,
      },
      {
        path: "somatic",
        Component: SomaticArchitectLandingPage,
      },
      {
        path: "system",
        Component: SystemEntryPage,
      },
      {
        path: "system/login",
        Component: SystemLoginPage,
      },
      {
        path: "system/onboarding",
        Component: SystemOnboardingPage,
      },
      {
        path: "system/goals",
        Component: SystemGoalEntryPage,
      },
      {
        path: "system/assessment",
        Component: SystemAssessmentIntroPage,
      },
      {
        path: "system/assessment-list",
        Component: SystemAssessmentListPage,
      },
      {
        path: "system/assessment-active",
        Component: SystemActiveAssessmentPage,
      },
      {
        path: "system/profile",
        Component: AthleteProfilePage,
      },
      {
        path: "system/history",
        Component: SystemHistoryPage,
      },
      {
        path: "system/summary",
        Component: SystemSummaryPage,
      }
    ],
  },
]);
