/**
 * Consistent API envelope + error handling (spec #28).
 * Every endpoint returns { success, data, message }.
 */

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, message?: string, status = 200): Response {
  return Response.json({ success: true, data, message: message ?? null }, { status });
}

export function created<T>(data: T, message = "Created"): Response {
  return ok(data, message, 201);
}

/** Wrap a handler: ApiError -> envelope error, unexpected -> 500 envelope. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return Response.json(
        { success: false, data: null, message: err.message },
        { status: err.status }
      );
    }
    console.error("[api] unexpected error:", err);
    return Response.json(
      { success: false, data: null, message: "Internal server error" },
      { status: 500 }
    );
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function pageParams(request: Request): { page: number; pageSize: number } {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size") ?? 20) || 20));
  return { page, pageSize };
}
