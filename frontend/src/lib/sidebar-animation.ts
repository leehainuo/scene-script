let hasConsumedSidebarEntranceAnimation = false

export function consumeSidebarEntranceAnimation() {
  if (hasConsumedSidebarEntranceAnimation) {
    return false
  }

  hasConsumedSidebarEntranceAnimation = true
  return true
}
