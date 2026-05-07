import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  createPinnedDigitalHumansRouter,
  PINNED_DIGITAL_HUMANS_PATH,
  readPostPinnedDigitalHumansRequest,
  readRequiredAuthenticatedUserId
} from "./pinned-digital-humans";

/**
 * Creates a minimal response double with chainable methods.
 *
 * @returns The mocked response object.
 */
function createResponseDouble(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  vi.mocked(response.status).mockReturnValue(response);

  return response;
}

/**
 * Reads one router layer by path and HTTP method.
 *
 * @param router Express router under test.
 * @param path Registered route path.
 * @param method Expected HTTP method.
 * @returns The matched route layer when found.
 */
function findRouteLayer(
  router: {
    stack: Array<{
      route?: {
        path: string;
        methods?: Record<string, boolean>;
        stack: Array<{
          handle: (
            request: Request,
            response: Response,
            next: NextFunction
          ) => Promise<void>;
        }>;
      };
    }>;
  },
  path: string,
  method: "get" | "post" | "delete"
) {
  return router.stack.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method] === true
  );
}

describe("readRequiredAuthenticatedUserId", () => {
  it("returns the normalized injected user id", () => {
    expect(
      readRequiredAuthenticatedUserId({
        headers: {
          "x-user-id": " user-1 "
        }
      } as Request)
    ).toBe("user-1");
  });

  it("rejects requests without an authenticated user id", () => {
    expect(() =>
      readRequiredAuthenticatedUserId({
        headers: {}
      } as Request)
    ).toThrow("Authenticated user id is required");
  });
});

describe("readPostPinnedDigitalHumansRequest", () => {
  it("accepts a request body with one pinned digital human id", () => {
    expect(
      readPostPinnedDigitalHumansRequest({
        pinned_digital_human_id: "dh-1"
      })
    ).toEqual({
      pinned_digital_human_id: "dh-1"
    });
  });

  it("trims the pinned digital human id", () => {
    expect(
      readPostPinnedDigitalHumansRequest({
        pinned_digital_human_id: " dh-1 "
      })
    ).toEqual({
      pinned_digital_human_id: "dh-1"
    });
  });

  it("rejects invalid request bodies", () => {
    expect(() => readPostPinnedDigitalHumansRequest(null)).toThrow(
      "Request body must be a JSON object"
    );
    expect(() => readPostPinnedDigitalHumansRequest([])).toThrow(
      "Request body must be a JSON object"
    );
    expect(() => readPostPinnedDigitalHumansRequest({})).toThrow(
      "`pinned_digital_human_id` is required"
    );
  });
});

describe("createPinnedDigitalHumansRouter", () => {
  it("registers pinned digital humans routes", () => {
    const router = createPinnedDigitalHumansRouter({
      getPinnedDigitalHumans: vi.fn(),
      postPinnedDigitalHumans: vi.fn(),
      deletePinnedDigitalHuman: vi.fn()
    }) as {
      stack: Array<{
        route?: {
          path: string;
          methods?: Record<string, boolean>;
        };
      }>;
    };

    expect(findRouteLayer(router, PINNED_DIGITAL_HUMANS_PATH, "get")).toBeDefined();
    expect(findRouteLayer(router, PINNED_DIGITAL_HUMANS_PATH, "post")).toBeDefined();
    expect(
      findRouteLayer(
        router,
        `${PINNED_DIGITAL_HUMANS_PATH}/:pinnedDigitalHumanId`,
        "delete"
      )
    ).toBeDefined();
  });

  it("handles one get request", async () => {
    const getPinnedDigitalHumans = vi.fn().mockResolvedValue({
      pinned_digital_humans: [
        { id: "dh-1", name: "A" },
        { id: "dh-2", name: "B" }
      ]
    });
    const router = createPinnedDigitalHumansRouter({
      getPinnedDigitalHumans,
      postPinnedDigitalHumans: vi.fn(),
      deletePinnedDigitalHuman: vi.fn()
    }) as Parameters<typeof findRouteLayer>[0];
    const layer = findRouteLayer(router, PINNED_DIGITAL_HUMANS_PATH, "get");
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await layer?.route?.stack[0]?.handle(
      {
        headers: {
          "x-user-id": "user-1"
        }
      } as Request,
      response,
      next
    );

    expect(getPinnedDigitalHumans).toHaveBeenCalledWith("user-1");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      pinned_digital_humans: [
        { id: "dh-1", name: "A" },
        { id: "dh-2", name: "B" }
      ]
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("handles one post request", async () => {
    const postPinnedDigitalHumans = vi.fn().mockResolvedValue({
      pinned_digital_humans: [
        { id: "dh-1", name: "A" },
        { id: "dh-2", name: "B" }
      ]
    });
    const router = createPinnedDigitalHumansRouter({
      getPinnedDigitalHumans: vi.fn(),
      postPinnedDigitalHumans,
      deletePinnedDigitalHuman: vi.fn()
    }) as Parameters<typeof findRouteLayer>[0];
    const layer = findRouteLayer(router, PINNED_DIGITAL_HUMANS_PATH, "post");
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await layer?.route?.stack[0]?.handle(
      {
        headers: {
          "x-user-id": "user-1"
        },
        body: {
          pinned_digital_human_id: "dh-1"
        }
      } as Request,
      response,
      next
    );

    expect(postPinnedDigitalHumans).toHaveBeenCalledWith("user-1", {
      pinned_digital_human_id: "dh-1"
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("handles one delete request", async () => {
    const deletePinnedDigitalHuman = vi.fn().mockResolvedValue({
      pinned_digital_humans: [{ id: "dh-2", name: "B" }]
    });
    const router = createPinnedDigitalHumansRouter({
      getPinnedDigitalHumans: vi.fn(),
      postPinnedDigitalHumans: vi.fn(),
      deletePinnedDigitalHuman
    }) as Parameters<typeof findRouteLayer>[0];
    const layer = findRouteLayer(
      router,
      `${PINNED_DIGITAL_HUMANS_PATH}/:pinnedDigitalHumanId`,
      "delete"
    );
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await layer?.route?.stack[0]?.handle(
      {
        headers: {
          "x-user-id": "user-1"
        },
        params: {
          pinnedDigitalHumanId: "dh-1"
        }
      } as unknown as Request,
      response,
      next
    );

    expect(deletePinnedDigitalHuman).toHaveBeenCalledWith("user-1", "dh-1");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
