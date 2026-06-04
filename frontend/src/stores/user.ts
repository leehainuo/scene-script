import { create } from "zustand"
import type { User } from "@/types"

interface UserState {
  // State
  users: User[]
  selectedUser: User | null
  total: number
  currentPage: number
  pageSize: number

  // Actions
  setUsers: (users: User[], total: number) => void
  setSelectedUser: (user: User | null) => void
  updateUser: (userId: number, user: Partial<User>) => void
  deleteUser: (userId: number) => void
  setPagination: (page: number, pageSize: number) => void
  reset: () => void
}

export const useUserStore = create<UserState>()((set) => ({
  // Initial State
  users: [],
  selectedUser: null,
  total: 0,
  currentPage: 1,
  pageSize: 10,

  // Set Users List
  setUsers: (users, total) => {
    set({ users, total })
  },

  // Set Selected User
  setSelectedUser: (user) => {
    set({ selectedUser: user })
  },

  // Update User in List
  updateUser: (userId, updatedUser) => {
    set((state) => ({
      users: state.users.map((user) =>
        user.user_id === userId ? { ...user, ...updatedUser } : user
      ),
    }))
  },

  // Delete User from List
  deleteUser: (userId) => {
    set((state) => ({
      users: state.users.filter((user) => user.user_id !== userId),
      total: state.total - 1,
    }))
  },

  // Set Pagination
  setPagination: (page, pageSize) => {
    set({ currentPage: page, pageSize })
  },

  // Reset State
  reset: () => {
    set({
      users: [],
      selectedUser: null,
      total: 0,
      currentPage: 1,
      pageSize: 10,
    })
  },
}))
