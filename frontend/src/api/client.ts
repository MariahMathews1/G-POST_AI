export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the machine service. Check that the backend is running and try again.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const fields: Record<string, string> = {};
    if (response.status === 422 && Array.isArray(body.detail)) {
      for (const item of body.detail) {
        if (Array.isArray(item.loc) && typeof item.loc[1] === "string") {
          fields[item.loc[1]] =
            item.type === "string_too_short" || item.type === "missing"
              ? "This field is required."
              : "Enter a valid value.";
        }
      }
    }
    const message =
      response.status === 404
        ? "Machine not found."
        : response.status === 422
          ? "Check the highlighted fields."
          : response.status === 503
            ? "Machine data is temporarily unavailable. Try again."
            : "The machine request could not be completed. Try again.";
    throw new ApiError(message, response.status, fields);
  }
  return response.json() as Promise<T>;
}
