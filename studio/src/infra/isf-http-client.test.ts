import { describe, expect, it, vi } from "vitest";

import {
  buildIsfUrl,
  createIsfHeaders,
  DefaultIsfHttpClient,
  normalizeIsfError
} from "./isf-http-client";

describe("buildIsfUrl", () => {
  it("joins the base URL, path and query values", () => {
    expect(
      buildIsfUrl("http://127.0.0.1:13014/base?x=1", "/api/user-management/v1/apps", {
        keyword: "agent",
        limit: 20,
        type: ["app", "user"],
        empty: ""
      })
    ).toBe(
      "http://127.0.0.1:13014/api/user-management/v1/apps?keyword=agent&limit=20&type=app&type=user"
    );
  });
});

describe("createIsfHeaders", () => {
  it("sets json and authorization headers when needed", () => {
    const headers = createIsfHeaders("token-1", { id: "app-1" });

    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json;charset=UTF-8");
    expect(headers.get("authorization")).toBe("Bearer token-1");
  });

  it("omits content-type when there is no body", () => {
    const headers = createIsfHeaders();

    expect(headers.get("content-type")).toBeNull();
  });
});

describe("normalizeIsfError", () => {
  it("wraps transport errors", () => {
    expect(normalizeIsfError(new Error("offline"))).toMatchObject({
      statusCode: 502,
      message: "Failed to communicate with ISF: offline"
    });
  });
});

describe("DefaultIsfHttpClient", () => {
  it("forwards requests with query, json body and bearer token", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{\"ok\":true}", {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new DefaultIsfHttpClient(
      {
        baseUrl: "http://127.0.0.1:13014",
        timeoutMs: 5000
      },
      fetchImpl
    );

    await expect(
      client.forwardRequest("/api/authorization/v1/policy", {
        method: "POST",
        query: { dry_run: false },
        body: [{ id: "policy-1" }],
        bearerToken: "token-1"
      })
    ).resolves.toEqual({
      status: 201,
      headers: expect.any(Headers),
      body: "{\"ok\":true}"
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:13014/api/authorization/v1/policy?dry_run=false"
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: "[{\"id\":\"policy-1\"}]"
    });
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token-1");
  });

  it("temporarily relaxes TLS verification for https by default", async () => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0");
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const client = new DefaultIsfHttpClient(
      {
        baseUrl: "https://127.0.0.1:13014",
        timeoutMs: 5000
      },
      fetchImpl
    );

    await client.forwardRequest("/api/user-management/v1/apps", {
      method: "GET"
    });

    expect(fetchImpl).toHaveBeenCalled();
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("does not relax TLS verification for http", async () => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const client = new DefaultIsfHttpClient(
      {
        baseUrl: "http://127.0.0.1:13014",
        timeoutMs: 5000
      },
      fetchImpl
    );

    await client.forwardRequest("/api/user-management/v1/apps", {
      method: "GET"
    });
  });
});
