export { aiPhase, type AiMarkLike, type AiPhase } from "./aiMark";
export {
  attemptDuration,
  DEFAULT_MAX_GAP_MS,
  type TimedAttempt,
} from "./attemptDuration";
export {
  REVIEW_DELAY_HOURS,
  REVIEW_DELAY_MS,
  isIndependent,
  hasIndependentSolution,
  computeAiDueAt,
} from "./solutions";
export {
  isDone,
  remainingCount,
  examProgress,
  type ProblemProgressInput,
  type ExamProgress,
} from "./progress";
export {
  dueProblems,
  unnotified,
  type DueMarkInput,
  type DueProblemInput,
} from "./dueQueue";
export {
  GRILA_MAX_TRIES,
  grilaCountsAsDone,
  grilaLocked,
  visibleAttempts,
  solveState,
  type AttemptLike,
  type SolveState,
} from "./solveState";
export {
  AXIS_VALUES,
  T_VALUES,
  P_VALUES,
  K_VALUES,
  V_VALUES,
  LEVELS,
  DEPARTAJARE_LEVEL,
  MARGIN_TOLERANCE,
  computeDRaw,
  levelFor,
  isBandMargin,
  archetypeFor,
  grade,
  meetsMinLevel,
  starSlots,
  levelLabel,
  type Archetype,
  type DifficultyLevel,
  type DifficultyScores,
  type GradedDifficulty,
} from "./difficulty";
export {
  DEFAULT_SORT,
  SORT_KEYS,
  needsDifficulty,
  sortProblems,
  type SortContext,
  type SortKey,
  type SortableProblem,
} from "./sorting";
export {
  tagCounts,
  matchesFilters,
  selectVisible,
  type FilterableProblem,
  type ListProblem,
  type ProblemFilters,
  type TagCounts,
} from "./tagFilters";
