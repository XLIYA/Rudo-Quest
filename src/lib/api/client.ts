"use client";

import axios, { AxiosError, type AxiosInstance } from "axios";
import type { ApiFailure, ApiSuccess } from "@/types/domain";

export type ApiClientError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
  status: number;
};

function isApiClientError(error: unknown): error is ApiClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "requestId" in error &&
    "status" in error
  );
}

/**
 * Purpose: Normalize any Axios failure into the single typed API error shape.
 * Inputs: Unknown caught error.
 * Output: ApiClientError for UI and mutation rollback handling.
 * Side effects: None.
 */
export function normalizeApiClientError(error: unknown): ApiClientError {
  if (isApiClientError(error)) return error;
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiFailure | undefined;
    const normalized: ApiClientError = {
      code: data?.error.code ?? "NETWORK_ERROR",
      message: data?.error.message ?? "Network request failed.",
      requestId: data?.requestId ?? error.response?.headers["x-request-id"] ?? crypto.randomUUID(),
      status: error.response?.status ?? 0,
    };
    if (data?.error.fieldErrors) normalized.fieldErrors = data.error.fieldErrors;
    return normalized;
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "Unexpected client error.",
    requestId: crypto.randomUUID(),
    status: 0,
  };
}

/**
 * Purpose: Create Rudo Quest's single browser-side Axios client.
 * Inputs: None.
 * Output: Configured Axios instance.
 * Side effects: Attaches request IDs and response error normalization.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: "/",
    withCredentials: true,
    timeout: 20_000,
  });
  client.interceptors.request.use((config) => {
    config.headers.set("x-request-id", crypto.randomUUID());
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(normalizeApiClientError(error)),
  );
  return client;
}

export const apiClient = createApiClient();

/**
 * Purpose: Fetch a typed API success payload with the shared Axios client.
 * Inputs: URL and optional AbortSignal.
 * Output: Data payload.
 * Side effects: Performs same-origin HTTP GET.
 */
export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await apiClient.get<ApiSuccess<T>>(url, signal ? { signal } : undefined);
  return response.data.data;
}

/**
 * Purpose: Send a typed API mutation with the shared Axios client.
 * Inputs: HTTP method, URL, optional body, and AbortSignal.
 * Output: Data payload.
 * Side effects: Performs same-origin HTTP mutation.
 */
export async function apiMutation<T>(
  method: "post" | "patch" | "delete",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const config = {
    method,
    url,
    data: body,
    ...(signal ? { signal } : {}),
  };
  const response = await apiClient.request<ApiSuccess<T>>(config);
  return response.data.data;
}
