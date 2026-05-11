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

  it("enriches list entries with statistics when requested", async () => {
    const listKnowledgeNetworks = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: JSON.stringify({
        entries: [
          { id: "kn-1", name: "Network 1" },
          { id: "kn-2", name: "Network 2" }
        ],
        total_count: 2
      })
    });
    const getKnowledgeNetwork = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        body: JSON.stringify({
          id: "kn-1",
          statistics: {
            object_types_total: 3,
            relation_types_total: 2,
            action_types_total: 1
          }
        })
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        body: JSON.stringify({
          id: "kn-2",
          statistics: {
            object_types_total: 4,
            relation_types_total: 5,
            action_types_total: 6
          }
        })
      });
    const logic = new DefaultBknLogic({
      adapter: {
        listKnowledgeNetworks,
        getKnowledgeNetwork
      }
    });

    const response = await logic.listKnowledgeNetworks(
      { limit: "10", include_statistics: "true" },
      "bd_a",
      "token-a"
    );

    expect(listKnowledgeNetworks).toHaveBeenCalledWith({ limit: "10" }, "bd_a", "token-a");
    expect(getKnowledgeNetwork).toHaveBeenNthCalledWith(
      1,
      "kn-1",
      { include_statistics: "true" },
      "bd_a",
      "token-a"
    );
    expect(getKnowledgeNetwork).toHaveBeenNthCalledWith(
      2,
      "kn-2",
      { include_statistics: "true" },
      "bd_a",
      "token-a"
    );
    expect(JSON.parse(response.body)).toEqual({
      entries: [
        {
          id: "kn-1",
          name: "Network 1",
          statistics: {
            object_types_total: 3,
            relation_types_total: 2,
            action_types_total: 1
          }
        },
        {
          id: "kn-2",
          name: "Network 2",
          statistics: {
            object_types_total: 4,
            relation_types_total: 5,
            action_types_total: 6
          }
        }
      ],
      total_count: 2
    });
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
