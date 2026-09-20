export const COLORS = {
  mdp: "#10B981", // emerald: optimal MDP / success
  teal: "#14B8A6",
  threshold: "#F59E0B", // amber: thresholds / baseline
  eoq: "#38BDF8", // sky: comparison / neutral data
  indigo: "#6366F1",
  danger: "#F43F5E", // rose: shortage / backlog
  grid: "#27272a",
  axis: "#71717a",
  tooltipBg: "#12151E",
} as const;

export const tooltipStyle = {
  backgroundColor: COLORS.tooltipBg,
  border: "1px solid #27272a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
} as const;
