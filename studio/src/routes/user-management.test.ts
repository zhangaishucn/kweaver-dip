import type { NextFunction, Request, Response, Router } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserManagementAdapter } from "../adapters/user-management-adapter";
import { HttpError } from "../errors/http-error";
import { readOptionalBearerToken } from "./proxy-auth";
import { createUserManagementRouter } from "./user-management";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/**
 * Creates a minimal response double with chainable methods.
 *
 * @returns The mocked response object.
 */
function createResponseDouble(): Response {
  const response = {
    status: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn()
  } as unknown as Response;

  vi.mocked(response.status).mockReturnValue(response);

  return response;
}

/**
 * Locates an Express route handler by path and HTTP method.
 *
 * @param router The Express router.
 * @param method HTTP method.
 * @param path Route path string.
 * @returns The handler function, if any.
 */
function findHandler(
  router: Router,
  method: "get" | "post",
  path: string
):
  | ((
      request: Request,
      response: Response,
      next: NextFunction
    ) => Promise<void>)
  | undefined {
  const layer = router.stack.find((item) => {
    const route = item.route;

    if (!route || route.path !== path) {
      return false;
    }

    return Boolean((route.methods as Record<string, boolean>)[method]);
  });

  return layer?.route?.stack[0]?.handle;
}

/**
 * Creates a user-management adapter test double.
 *
 * @returns A mocked adapter object.
 */
function createAdapterDouble(): UserManagementAdapter {
  return {
    listApps: vi.fn(),
    createApp: vi.fn(),
    createAppToken: vi.fn()
  };
}

describe("createUserManagementRouter", () => {
  const appsPath = "/api/dip-studio/v1/user-management/apps";
  const tokensPath = "/api/dip-studio/v1/user-management/console/app-tokens";

  it("registers all user-management routes", () => {
    const router = createUserManagementRouter(createAdapterDouble()) as Router;

    expect(findHandler(router, "get", appsPath)).toBeDefined();
    expect(findHandler(router, "post", appsPath)).toBeDefined();
    expect(findHandler(router, "post", tokensPath)).toBeDefined();
  });

  it("forwards list requests with bearer token", async () => {
    const adapter = createAdapterDouble();
    vi.mocked(adapter.listApps).mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: "{\"entries\":[]}"
    });
    const handler = findHandler(createUserManagementRouter(adapter) as Router, "get", appsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      {
        query: { keyword: "agent" },
        headers: { authorization: "Bearer token-1" }
      } as unknown as Request,
      response,
      next
    );

    expect(adapter.listApps).toHaveBeenCalledWith(
      { keyword: "agent" },
      "token-1"
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith("{\"entries\":[]}");
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards create app token requests", async () => {
    const adapter = createAdapterDouble();
    vi.mocked(adapter.createAppToken).mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: "{\"token\":\"t\"}"
    });
    const handler = findHandler(createUserManagementRouter(adapter) as Router, "post", tokensPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      {
        body: { id: "app-1" },
        headers: { authorization: "Bearer token-1" }
      } as unknown as Request,
      response,
      next
    );

    expect(adapter.createAppToken).toHaveBeenCalledWith(
      { id: "app-1" },
      "token-1"
    );
    expect(response.send).toHaveBeenCalledWith("{\"token\":\"t\"}");
  });
});

describe("readOptionalBearerToken", () => {
  it("returns undefined when authorization is absent", () => {
    expect(readOptionalBearerToken({ headers: {} } as Request)).toBeUndefined();
  });

  it("returns the bearer token and rejects malformed values", () => {
    expect(
      readOptionalBearerToken({
        headers: { authorization: "Bearer token-1" }
      } as Request)
    ).toBe("token-1");
    expect(() =>
      readOptionalBearerToken({
        headers: { authorization: "Basic token-1" }
      } as Request)
    ).toThrowError(HttpError);
  });
});
