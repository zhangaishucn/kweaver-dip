import type { NextFunction, Request, Response, Router } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthorizationAdapter } from "../adapters/authorization-adapter";
import { createAuthorizationRouter } from "./authorization";

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
 * Creates an authorization adapter test double.
 *
 * @returns A mocked adapter object.
 */
function createAdapterDouble(): AuthorizationAdapter {
  return {
    listAccessorPolicies: vi.fn(),
    createPolicies: vi.fn()
  };
}

describe("createAuthorizationRouter", () => {
  const accessorPoliciesPath = "/api/dip-studio/v1/authorization/accessor-policy";
  const policyPath = "/api/dip-studio/v1/authorization/policy";

  it("registers all authorization routes", () => {
    const router = createAuthorizationRouter(createAdapterDouble()) as Router;

    expect(findHandler(router, "get", accessorPoliciesPath)).toBeDefined();
    expect(findHandler(router, "post", policyPath)).toBeDefined();
  });

  it("forwards accessor-policy requests", async () => {
    const adapter = createAdapterDouble();
    vi.mocked(adapter.listAccessorPolicies).mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: "{\"entries\":[]}"
    });
    const handler = findHandler(
      createAuthorizationRouter(adapter) as Router,
      "get",
      accessorPoliciesPath
    );
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      {
        query: { accessor_id: "app-1", accessor_type: "app" },
        headers: { authorization: "Bearer token-1" }
      } as unknown as Request,
      response,
      next
    );

    expect(adapter.listAccessorPolicies).toHaveBeenCalledWith(
      { accessor_id: "app-1", accessor_type: "app" },
      "token-1"
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith("{\"entries\":[]}");
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards policy creation requests", async () => {
    const adapter = createAdapterDouble();
    vi.mocked(adapter.createPolicies).mockResolvedValue({
      status: 201,
      headers: new Headers(),
      body: "{\"ids\":[\"p1\"]}"
    });
    const handler = findHandler(createAuthorizationRouter(adapter) as Router, "post", policyPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      {
        body: [{ id: "policy-1" }],
        headers: { authorization: "Bearer token-1" }
      } as unknown as Request,
      response,
      next
    );

    expect(adapter.createPolicies).toHaveBeenCalledWith(
      [{ id: "policy-1" }],
      "token-1"
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.send).toHaveBeenCalledWith("{\"ids\":[\"p1\"]}");
  });
});
