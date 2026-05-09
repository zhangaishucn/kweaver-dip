import { describe, expect, it, vi } from "vitest";

import { DefaultBknLogic } from "./bkn";

describe("DefaultBknLogic", () => {
  it("delegates list requests to the BKN adapter", async () => {
    const listKnowledgeNetworks = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: "{}"
    });
    const adapter = {
      listKnowledgeNetworks,
      getKnowledgeNetwork: vi.fn()
    };
    const logic = new DefaultBknLogic({ adapter });

    await logic.listKnowledgeNetworks({ limit: "10" }, "bd_a", "token-a");
    await logic.listKnowledgeNetworks({ limit: "20" }, "bd_b", "token-b");

    expect(listKnowledgeNetworks).toHaveBeenNthCalledWith(1, { limit: "10" }, "bd_a", "token-a");
    expect(listKnowledgeNetworks).toHaveBeenNthCalledWith(2, { limit: "20" }, "bd_b", "token-b");
  });

  it("delegates detail requests to the BKN adapter", async () => {
    const getKnowledgeNetwork = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      body: "{\"id\":\"kn-1\"}"
    });
    const logic = new DefaultBknLogic({
      adapter: {
      listKnowledgeNetworks: vi.fn(),
      getKnowledgeNetwork
      }
    });

    await logic.getKnowledgeNetwork(
      "kn-1",
      { include_statistics: "true" },
      "bd_public",
      "token-a"
    );

    expect(getKnowledgeNetwork).toHaveBeenCalledWith(
      "kn-1",
      { include_statistics: "true" },
      "bd_public",
      "token-a"
    );
  });
});
