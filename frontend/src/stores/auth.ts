import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/types"
import { setTokens, clearTokens, isAuthenticated } from "@/lib/axios"

interface AuthState {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial State
      user: null,
      isAuthenticated: isAuthenticated(),
      isLoading: false,

      // Login Action
      login: (user, accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken)
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      // Logout Action
      logout: () => {
        clearTokens()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      // Update User Info
      updateUser: (updatedUser) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        }))
      },

      // Set Loading State
      setLoading: (loading) => {
        set({ isLoading: loading })
      },
    }),
    {
      name: "auth-storage", // localStorage key
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
