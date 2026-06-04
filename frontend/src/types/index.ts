// Export all types from a single entry point
export * from "./api"
export * from "./auth"
export * from "./script"
export * from "./user"

// Common Types
export type ID = number | string

export type Status = "active" | "inactive" | "pending"

export type SortOrder = "asc" | "desc"
