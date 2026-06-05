import client, { LONG_TASK_REQUEST_TIMEOUT, buildApiUrl, getAccessToken } from "@/lib/axios"
import type {
  ApiResponse,
  SaveScriptResultRequest,
  ScriptConvertRequest,
  ScriptConvertResponse,
  ScriptDetailResponse,
  ScriptListParams,
  ScriptListResponse,
  ScriptTaskEvent,
} from "@/types"

export const convertScript = async (data: ScriptConvertRequest) => {
  const response = await client.post<ApiResponse<ScriptConvertResponse>>(
    "/script/convert",
    data,
    {
      timeout: LONG_TASK_REQUEST_TIMEOUT,
    }
  )
  return response.data
}

export const getScriptHistory = async (params?: ScriptListParams) => {
  const response = await client.get<ApiResponse<ScriptListResponse>>("/script", {
    params,
  })
  return response.data
}

export const getScriptDetail = async (id: string) => {
  const response = await client.get<ApiResponse<ScriptDetailResponse>>(
    `/script/${id}`
  )
  return response.data
}

export const saveScriptResult = async (
  id: string,
  data: SaveScriptResultRequest
) => {
  const response = await client.put<ApiResponse<ScriptDetailResponse>>(
    `/script/${id}/result`,
    data
  )
  return response.data
}

export const openScriptEventStream = (
  eventUrl: string,
  onEvent: (event: ScriptTaskEvent) => void,
  onError?: (event: Event) => void
) => {
  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error("登录状态已失效，请重新登录后再试。")
  }

  const resolvedUrl = buildApiUrl(eventUrl)
  const streamUrl = new URL(
    resolvedUrl,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  )
  streamUrl.searchParams.set("access_token", accessToken)

  const eventSource = new EventSource(streamUrl.toString())
  eventSource.addEventListener("script-task", (rawEvent) => {
    const messageEvent = rawEvent as MessageEvent<string>
    try {
      const payload = JSON.parse(messageEvent.data) as ScriptTaskEvent
      onEvent(payload)
    } catch {
      // Ignore malformed event payloads and keep the stream alive.
    }
  })
  if (onError) {
    eventSource.onerror = onError
  }
  return eventSource
}
