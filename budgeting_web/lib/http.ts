export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wraps a handler so thrown ApiErrors become JSON responses. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return Response.json({ detail: err.message }, { status: err.status });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ detail: message }, { status: 500 });
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function idFrom(request: Request): number {
  const id = Number(new URL(request.url).pathname.split("/").filter(Boolean).pop());
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id");
  }
  return id;
}
