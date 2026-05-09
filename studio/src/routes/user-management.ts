import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  DefaultUserManagementAdapter,
  type UserManagementAdapter
} from "../adapters/user-management-adapter";
import { HttpError } from "../errors/http-error";
import type { IsfQuery } from "../infra/isf-http-client";
import { writeProxyResponse } from "./bkn";
import { readOptionalBearerToken } from "./proxy-auth";

/**
 * Builds the user-management proxy router.
 *
 * @param adapter Optional user-management adapter implementation.
 * @returns The router exposing user-management proxy endpoints.
 */
export function createUserManagementRouter(
  adapter: UserManagementAdapter = new DefaultUserManagementAdapter()
): Router {
  const router = Router();

  router.get(
    "/api/dip-studio/v1/user-management/apps",
    async (
      request: Request<unknown, unknown, unknown, IsfQuery>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.listApps(
          request.query,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to query application accounts"));
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/user-management/apps",
    async (
      request: Request<unknown, unknown, unknown, unknown>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.createApp(
          request.body,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to create application account"));
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/user-management/console/app-tokens",
    async (
      request: Request<unknown, unknown, unknown, unknown>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.createAppToken(
          request.body,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to create application account token"));
      }
    }
  );

  return router;
}
