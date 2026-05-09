import type { Request } from "express";

import { HttpError } from "../errors/http-error";

/**
 * Reads an optional bearer token from the incoming request for upstream forwarding.
 *
 * @param request Incoming Express request.
 * @returns The bearer token when present and well-formed.
 */
export function readOptionalBearerToken(request: Pick<Request, "headers">): string | undefined {
  const authorization = request.headers.authorization;

  if (typeof authorization !== "string" || authorization.trim().length === 0) {
    return undefined;
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (scheme !== "Bearer" || token === undefined || token.trim().length === 0) {
    throw new HttpError(401, "Authorization header must use Bearer token");
  }

  return token.trim();
}
