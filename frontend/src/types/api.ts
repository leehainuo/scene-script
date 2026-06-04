// API Response Structure (matches backend response format)
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

// Pagination Request
export interface PaginationParams {
  page?: number
  page_size?: number
}

// Pagination Response
export interface PaginationData<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}
