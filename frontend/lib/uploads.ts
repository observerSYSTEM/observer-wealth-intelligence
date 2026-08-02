import { ApiError, apiFetch } from "@/lib/api";

const retryableUploadStatuses = new Set([0, 500, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error: unknown): error is ApiError {
  return error instanceof ApiError && retryableUploadStatuses.has(error.status);
}

export async function uploadReceiptFile<T>(file: File, attempts = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const form = new FormData();
    form.append("receipt", file);
    try {
      return await apiFetch<T>("receipts", {
        method: "POST",
        body: form
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt === attempts) {
        throw error;
      }
      if (process.env.NODE_ENV === "development") {
        console.warn("OWI receipt upload retry", { attempt, status: error.status });
      }
      await delay(500 * attempt);
    }
  }

  throw lastError;
}
