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
  const resource = path.includes("/profile")
    ? "profile"
    : path.startsWith("/documents")
      ? "document"
      : "machine";
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      `Cannot reach the ${resource} service. Check that the backend is running and try again.`,
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
    if (
      resource !== "machine" &&
      typeof body.field === "string" &&
      typeof body.detail === "string"
    )
      fields[body.field] = body.detail;
    const message =
      resource !== "machine" &&
      [400, 404, 413, 415, 422, 503].includes(response.status) &&
      typeof body.detail === "string"
        ? body.detail
        : response.status === 404
          ? `${resource === "document" ? "Document" : "Machine"} not found.`
          : response.status === 422
            ? "Check the highlighted fields."
            : response.status === 503
              ? `${resource === "document" ? "Document" : "Machine"} data is temporarily unavailable. Try again.`
              : `The ${resource} request could not be completed. Try again.`;
    throw new ApiError(message, response.status, fields);
  }
  return response.json() as Promise<T>;
}
