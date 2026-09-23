import { Platform } from "react-native";

const LOCAL_API = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || LOCAL_API).replace(/\/$/, "");

type ApiOptions = RequestInit & { timeoutMs?: number };

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });

    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ApiError("The server returned an unreadable response.", response.status);
    }

    if (!response.ok) {
      throw new ApiError(data?.error || "Something went wrong. Please try again.", response.status);
    }

    return data as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiError("The request took too long. Check your connection and try again.");
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("Nouri could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
