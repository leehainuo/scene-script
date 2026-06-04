import client from "@/lib/axios"
import type {
  ApiResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserListParams,
  PaginationData,
} from "@/types"

// Get User List
export const getUserList = async (params?: UserListParams) => {
  const response = await client.get<ApiResponse<PaginationData<User>>>(
    "/users",
    { params }
  )
  return response.data
}

// Get User by ID
export const getUserById = async (id: number) => {
  const response = await client.get<ApiResponse<User>>(`/users/${id}`)
  return response.data
}

// Create User
export const createUser = async (data: CreateUserRequest) => {
  const response = await client.post<ApiResponse<User>>("/users", data)
  return response.data
}

// Update User
export const updateUser = async (id: number, data: UpdateUserRequest) => {
  const response = await client.put<ApiResponse<User>>(`/users/${id}`, data)
  return response.data
}

// Delete User
export const deleteUser = async (id: number) => {
  const response = await client.delete<ApiResponse<void>>(`/users/${id}`)
  return response.data
}
