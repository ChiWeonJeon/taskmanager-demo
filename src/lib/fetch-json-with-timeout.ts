export class FetchTimeoutError extends Error {
  constructor() {
    super("Request timed out. Please try again in a moment.");
    this.name = "FetchTimeoutError";
  }
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
