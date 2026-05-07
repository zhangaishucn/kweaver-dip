import { describe, expect, it } from "vitest";

import { HttpError } from "../errors/http-error";
import type { DigitalHumanDetail } from "../types/digital-human";
import {
  DefaultPinnedDigitalHumansLogic,
  materializePinnedDigitalHumans,
  MAX_PINNED_DIGITAL_HUMAN_ID_LENGTH,
  mergePinToFront,
  normalizePinnedDigitalHumanId,
  type PinnedDigitalHumansDisplaySource,
  type PinnedDigitalHumansStore
} from "./pinned-digital-humans";

/**
 * In-memory store used by pinned digital humans logic tests.
 */
class MemoryPinnedDigitalHumansStore implements PinnedDigitalHumansStore {
  /**
   * Captures persisted snapshots by user id.
   */
  public readonly values = new Map<string, { pinned_digital_human_ids: string[] }>();

  /**
   * Reads one user's stored snapshot.
   *
   * @param userId Authenticated user identifier.
   * @returns The stored snapshot or an empty default.
   */
  public async getByUserId(userId: string) {
    return this.values.get(userId) ?? { pinned_digital_human_ids: [] };
  }

  /**
   * Replaces one user's stored snapshot.
   *
   * @param userId Authenticated user identifier.
   * @param state Normalized id list.
   */
  public async upsert(
    userId: string,
    state: { pinned_digital_human_ids: string[] }
  ) {
    this.values.set(userId, {
      pinned_digital_human_ids: [...state.pinned_digital_human_ids]
    });
  }
}

function stubDetail(id: string, name: string): DigitalHumanDetail {
  return {
    id,
    name,
    soul: "",
    creature: "role",
    icon_id: "ic"
  };
}

function createDisplayStub(
  resolve: (id: string) => DigitalHumanDetail
): PinnedDigitalHumansDisplaySource {
  return {
    async getDigitalHuman(id: string) {
      return resolve(id);
    }
  };
}

describe("normalizePinnedDigitalHumanId", () => {
  it("trims and validates one id", () => {
    expect(normalizePinnedDigitalHumanId("  a  ")).toBe("a");
  });

  it("rejects empty ids", () => {
    expect(() => normalizePinnedDigitalHumanId("  ")).toThrow(HttpError);
  });

  it("rejects ids that exceed the length limit", () => {
    expect(() =>
      normalizePinnedDigitalHumanId("x".repeat(MAX_PINNED_DIGITAL_HUMAN_ID_LENGTH + 1))
    ).toThrow(HttpError);
  });
});

describe("mergePinToFront", () => {
  it("moves an existing id to the front", () => {
    expect(mergePinToFront(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });
});

describe("materializePinnedDigitalHumans", () => {
  it("omits ids that cannot be resolved", async () => {
    const display: PinnedDigitalHumansDisplaySource = {
      async getDigitalHuman(id: string) {
        if (id === "bad") {
          throw new HttpError(404, "gone");
        }
        return stubDetail(id, "Ok");
      }
    };
    const { rows, keptIds } = await materializePinnedDigitalHumans(
      ["dh-1", "bad", "dh-2"],
      display
    );
    expect(keptIds).toEqual(["dh-1", "dh-2"]);
    expect(rows).toEqual([
      { id: "dh-1", name: "Ok", creature: "role", icon_id: "ic" },
      { id: "dh-2", name: "Ok", creature: "role", icon_id: "ic" }
    ]);
  });
});

describe("DefaultPinnedDigitalHumansLogic", () => {
  it("returns composed sidebar rows for stored pinned ids", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    await store.upsert("u1", {
      pinned_digital_human_ids: ["dh-1", "dh-2"]
    });
    const display = createDisplayStub((id) => {
      if (id === "dh-1") {
        return stubDetail("dh-1", "One");
      }
      return stubDetail("dh-2", "Two");
    });
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(logic.getPinnedDigitalHumans("u1")).resolves.toEqual({
      pinned_digital_humans: [
        {
          id: "dh-1",
          name: "One",
          creature: "role",
          icon_id: "ic"
        },
        {
          id: "dh-2",
          name: "Two",
          creature: "role",
          icon_id: "ic"
        }
      ]
    });
  });

  it("filters unresolved ids and reconciles storage on get", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    await store.upsert("u1", { pinned_digital_human_ids: ["gone", "dh-1"] });
    const display = createDisplayStub((id) => {
      if (id === "gone") {
        throw new HttpError(404, "missing");
      }
      return stubDetail("dh-1", "One");
    });
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(logic.getPinnedDigitalHumans("u1")).resolves.toEqual({
      pinned_digital_humans: [
        { id: "dh-1", name: "One", creature: "role", icon_id: "ic" }
      ]
    });
    expect(await store.getByUserId("u1")).toEqual({
      pinned_digital_human_ids: ["dh-1"]
    });
  });

  it("pins one id to the front with put", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    await store.upsert("u1", { pinned_digital_human_ids: ["dh-2", "dh-1"] });
    const display = createDisplayStub((id) => stubDetail(id, `N-${id}`));
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(
      logic.postPinnedDigitalHumans("u1", {
        pinned_digital_human_id: "dh-1"
      })
    ).resolves.toEqual({
      pinned_digital_humans: [
        {
          id: "dh-1",
          name: "N-dh-1",
          creature: "role",
          icon_id: "ic"
        },
        {
          id: "dh-2",
          name: "N-dh-2",
          creature: "role",
          icon_id: "ic"
        }
      ]
    });

    expect(await store.getByUserId("u1")).toEqual({
      pinned_digital_human_ids: ["dh-1", "dh-2"]
    });
  });

  it("rejects pinning when that would create more than 8 distinct ids", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    const eight = Array.from({ length: 8 }, (_, i) => `dh-${i}`);
    await store.upsert("u1", { pinned_digital_human_ids: eight });
    const display = createDisplayStub((id) => stubDetail(id, id));
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(
      logic.postPinnedDigitalHumans("u1", { pinned_digital_human_id: "dh-new" })
    ).rejects.toThrow("at most 8 pinned");
  });

  it("propagates when the pinned id cannot be resolved", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    const display: PinnedDigitalHumansDisplaySource = {
      async getDigitalHuman() {
        throw new HttpError(404, "missing");
      }
    };
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(
      logic.postPinnedDigitalHumans("u1", { pinned_digital_human_id: "x" })
    ).rejects.toThrow("missing");
  });

  it("removes one id with deletePinnedDigitalHuman", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    await store.upsert("u1", { pinned_digital_human_ids: ["dh-1", "dh-2"] });
    const display = createDisplayStub((id) => stubDetail(id, `N-${id}`));
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(logic.deletePinnedDigitalHuman("u1", "dh-1")).resolves.toEqual({
      pinned_digital_humans: [
        { id: "dh-2", name: "N-dh-2", creature: "role", icon_id: "ic" }
      ]
    });
    expect(await store.getByUserId("u1")).toEqual({
      pinned_digital_human_ids: ["dh-2"]
    });
  });

  it("delete is idempotent when id was not pinned", async () => {
    const store = new MemoryPinnedDigitalHumansStore();
    await store.upsert("u1", { pinned_digital_human_ids: ["dh-1"] });
    const display = createDisplayStub((id) => stubDetail(id, `N-${id}`));
    const logic = new DefaultPinnedDigitalHumansLogic(store, display);

    await expect(logic.deletePinnedDigitalHuman("u1", "ghost")).resolves.toEqual({
      pinned_digital_humans: [
        { id: "dh-1", name: "N-dh-1", creature: "role", icon_id: "ic" }
      ]
    });
  });
});
