import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  DefaultAuthorizationAdapter,
  type AuthorizationAdapter
} from "../adapters/authorization-adapter";
import { HttpError } from "../errors/http-error";
import type { IsfQuery } from "../infra/isf-http-client";
import { writeProxyResponse } from "./bkn";
import { readOptionalBearerToken } from "./proxy-auth";

/**
 * Builds the authorization proxy router.
 *
 * @param adapter Optional authorization adapter implementation.
 * @returns The router exposing authorization proxy endpoints.
 */
export function createAuthorizationRouter(
  adapter: AuthorizationAdapter = new DefaultAuthorizationAdapter()
): Router {
  const router = Router();

  router.get(
    "/api/dip-studio/v1/authorization/accessor-policy",
    async (
      request: Request<unknown, unknown, unknown, IsfQuery>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.listAccessorPolicies(
          request.query,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to query accessor policies"));
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/authorization/policy",
    async (
      request: Request<unknown, unknown, unknown, unknown>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.createPolicies(
          request.body,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to create authorization policies"));
      }
    }
  );

  return router;
}
