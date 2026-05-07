import { Router, type NextFunction, type Request, type Response } from "express";

import { HttpError } from "../errors/http-error";
import { readAuthenticatedUserId } from "../middleware/hydra-auth";
import type {
  PostSidebarPinnedDigitalHumansRequest,
  SidebarPinnedDigitalHumansState
} from "../types/pinned-digital-humans";
import {
  DefaultPinnedDigitalHumansLogic,
  normalizePinnedDigitalHumanId,
  type PinnedDigitalHumansLogic
} from "../logic/pinned-digital-humans";
import {
  DefaultPinnedDigitalHumansMysqlStore
} from "../infra/pinned-digital-humans-mysql-store";
import { getEnv } from "../utils/env";
import { digitalHumanLogic } from "./digital-human";

/**
 * Converts unexpected failures into a public 502 HTTP error with optional development detail.
 *
 * @param verb Distinguishes read vs write paths in the user-facing message.
 * @param error Thrown unknown error payload.
 */
function toPinnedUpstreamHttpError(
  verb: "query" | "update",
  error: unknown
): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const description =
    verb === "query"
      ? "Failed to query sidebar pinned digital humans"
      : "Failed to update sidebar pinned digital humans";

  const detail =
    getEnv().isDevelopment && error instanceof Error
      ? { cause: error.message }
      : undefined;

  return new HttpError(502, description, "DipStudio.UpstreamServiceError", detail);
}

/**
 * HTTP base path for the pinned digital humans resource (issue #167).
 */
export const PINNED_DIGITAL_HUMANS_PATH =
  "/api/dip-studio/v1/pinned-digital-humans";

const env = getEnv();
const pinnedDigitalHumansLogic = new DefaultPinnedDigitalHumansLogic(
  new DefaultPinnedDigitalHumansMysqlStore({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName
  }),
  digitalHumanLogic
);

/**
 * Builds the router for the pinned digital humans API (backed by `t_studio_user_preference`).
 *
 * @param logic Optional {@link PinnedDigitalHumansLogic} override.
 * @returns The router exposing `/pinned-digital-humans`.
 */
export function createPinnedDigitalHumansRouter(
  logic: PinnedDigitalHumansLogic = pinnedDigitalHumansLogic
): Router {
  const router = Router();

  router.get(
    PINNED_DIGITAL_HUMANS_PATH,
    async (
      request: Request,
      response: Response<SidebarPinnedDigitalHumansState>,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = readRequiredAuthenticatedUserId(request);
        response.status(200).json(await logic.getPinnedDigitalHumans(userId));
      } catch (error) {
        next(toPinnedUpstreamHttpError("query", error));
      }
    }
  );

  router.post(
    PINNED_DIGITAL_HUMANS_PATH,
    async (
      request: Request,
      response: Response<SidebarPinnedDigitalHumansState>,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = readRequiredAuthenticatedUserId(request);
        const body = readPostPinnedDigitalHumansRequest(request.body);
        response.status(200).json(await logic.postPinnedDigitalHumans(userId, body));
      } catch (error) {
        next(toPinnedUpstreamHttpError("update", error));
      }
    }
  );

  router.delete(
    `${PINNED_DIGITAL_HUMANS_PATH}/:pinnedDigitalHumanId`,
    async (
      request: Request,
      response: Response<SidebarPinnedDigitalHumansState>,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = readRequiredAuthenticatedUserId(request);
        const digitalHumanId = normalizePinnedDigitalHumanId(
          request.params.pinnedDigitalHumanId
        );
        response
          .status(200)
          .json(await logic.deletePinnedDigitalHuman(userId, digitalHumanId));
      } catch (error) {
        next(toPinnedUpstreamHttpError("update", error));
      }
    }
  );

  return router;
}

/**
 * Reads the authenticated user id and rejects requests without one.
 *
 * @param request Incoming HTTP request.
 * @returns The normalized authenticated user id.
 */
export function readRequiredAuthenticatedUserId(request: Request): string {
  const userId = readAuthenticatedUserId(request);

  if (userId === undefined) {
    throw new HttpError(401, "Authenticated user id is required");
  }

  return userId;
}

/**
 * Validates the pinned digital humans POST request body (single id to pin).
 *
 * @param body Unknown request payload.
 * @returns The validated request body.
 */
export function readPostPinnedDigitalHumansRequest(
  body: unknown
): PostSidebarPinnedDigitalHumansRequest {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  if (!("pinned_digital_human_id" in record)) {
    throw new HttpError(400, "`pinned_digital_human_id` is required");
  }

  return {
    pinned_digital_human_id: normalizePinnedDigitalHumanId(
      record.pinned_digital_human_id
    )
  };
}
