import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="light"
      richColors
      toastOptions={{
        className: "font-sans",
      }}
    />
  )
}
