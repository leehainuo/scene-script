import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">页面未找到</h2>
        <p className="mt-2 text-muted-foreground">
          抱歉，您访问的页面不存在或已被移除
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            返回上一页
          </Button>
          <Button onClick={() => navigate("/")}>返回首页</Button>
        </div>
      </div>
    </div>
  )
}
