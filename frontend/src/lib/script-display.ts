const PACING_LABEL_MAP: Record<string, string> = {
  fast: "快节奏",
  medium: "中节奏",
  slow: "慢节奏",
}

export function getPacingLabel(pacing?: string) {
  if (!pacing) {
    return ""
  }

  return PACING_LABEL_MAP[pacing] ?? pacing
}

export function formatScriptStyleSummary(
  genre?: string,
  tone?: string,
  pacing?: string,
  separator = " - "
) {
  return [genre, tone, getPacingLabel(pacing)].filter(Boolean).join(separator)
}
