import client, { LONG_TASK_REQUEST_TIMEOUT } from "@/lib/axios"
import type {
  ApiResponse,
  ScriptConvertRequest,
  ScriptConvertResponse,
  ScriptDetailResponse,
  ScriptListParams,
  ScriptListResponse,
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
