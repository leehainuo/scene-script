// User Model
export interface User {
  user_id: number
  username: string
  email?: string
  avatar?: string
  role_id?: number
  created_at?: string
  updated_at?: string
}

// Create User Request
export interface CreateUserRequest {
  username: string
  password: string
  email?: string
  role_id?: number
}

// Update User Request
export interface UpdateUserRequest {
  username?: string
  email?: string
  avatar?: string
  role_id?: number
}

// User List Query Params
export interface UserListParams {
  page?: number
  page_size?: number
  username?: string
  role_id?: number
}
