import { describe, expect, it, vi } from "vitest";

import { DefaultBknAdapter } from "./bkn-adapter";

describe("DefaultBknAdapter", () => {
  it("uses kweaverBaseUrl and forwards knowledge network list requests", async () => {
    const forwardRequest = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: "{\"entries\":[]}"
    });
    const createClient = vi.fn().mockReturnValue({ forwardRequest });
    const adapter = new DefaultBknAdapter({
      getEnv: (() => ({
        bknBackendUrl: "http://bkn",
        kweaverBaseUrl: "http://kweaver",
        appUserToken: "token-1",
        openClawGatewayTimeoutMs: 5000
      })) as never,
      createClient
    });

    await adapter.listKnowledgeNetworks({ limit: "10" }, "bd_a", "user-token");

    expect(createClient).toHaveBeenCalledWith({
      baseUrl: "http://kweaver",
      timeoutMs: 5000
    });
    expect(forwardRequest).toHaveBeenCalledWith(
      "/api/bkn-backend/v1/knowledge-networks",
      {
        method: "GET",
        query: { limit: "10" },
        businessDomain: "bd_a",
        bearerToken: "user-token"
      }
    );
  });

  it("forwards knowledge network detail requests", async () => {
    const forwardRequest = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: "{\"id\":\"kn-1\"}"
    });
    const adapter = new DefaultBknAdapter({
      getEnv: (() => ({
        bknBackendUrl: "http://bkn",
        kweaverBaseUrl: "http://kweaver",
        appUserToken: undefined,
        openClawGatewayTimeoutMs: 5000
      })) as never,
      createClient: vi.fn().mockReturnValue({ forwardRequest })
    });

    await adapter.getKnowledgeNetwork(
      "kn/1",
      { include_statistics: "true" },
      "bd_b",
      "user-token"
    );

    expect(forwardRequest).toHaveBeenCalledWith(
      "/api/bkn-backend/v1/knowledge-networks/kn%2F1",
      {
        method: "GET",
        query: { include_statistics: "true" },
        businessDomain: "bd_b",
        bearerToken: "user-token"
      }
    );
  });
});
