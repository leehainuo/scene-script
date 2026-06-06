export function parseInlineList(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatInlineList(values?: string[]) {
  return (values ?? []).join("，")
}

export const detailCardEnterClass =
  "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both"

export function getDetailCardAnimationDelay(index: number) {
  return { animationDelay: `${Math.min(index, 8) * 60}ms` }
}
