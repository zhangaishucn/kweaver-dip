import { HttpError } from "../errors/http-error";
import type { DigitalHumanDetail } from "../types/digital-human";
import type {
  PinnedDigitalHumanIdsStored,
  PostSidebarPinnedDigitalHumansRequest,
  SidebarPinnedDigitalHuman,
  SidebarPinnedDigitalHumansState
} from "../types/pinned-digital-humans";

/**
 * Maximum number of pinned digital humans rendered in the Studio sidebar.
 */
export const MAX_PINNED_DIGITAL_HUMANS = 8;

/**
 * Maximum accepted digital human identifier length.
 */
export const MAX_PINNED_DIGITAL_HUMAN_ID_LENGTH = 128;

/**
 * Resolves display fields for pinned ids (typically backed by {@link DigitalHumanLogic.getDigitalHuman}).
 */
export interface PinnedDigitalHumansDisplaySource {
  /**
   * Loads one digital human detail used to populate sidebar labels and icons.
   *
   * @param id Agent / digital human identifier.
   */
  getDigitalHuman(id: string): Promise<DigitalHumanDetail>;
}

/**
 * Persistence port for pinned digital humans (`t_studio_user_preference.pinned_digital_human_ids` column).
 */
export interface PinnedDigitalHumansStore {
  /**
   * Reads one user's stored id list.
   *
   * @param userId Authenticated user identifier.
   * @returns The stored id snapshot.
   */
  getByUserId(userId: string): Promise<PinnedDigitalHumanIdsStored>;

  /**
   * Replaces one user's pinned digital human id list in storage.
   *
   * @param userId Authenticated user identifier.
   * @param state Normalized id list.
   */
  upsert(userId: string, state: PinnedDigitalHumanIdsStored): Promise<void>;
}

/**
 * Business logic for the Studio pinned digital humans HTTP API.
 */
export interface PinnedDigitalHumansLogic {
  /**
   * Returns one user's pinned list with server-composed display rows.
   *
   * @param userId Authenticated user identifier.
   */
  getPinnedDigitalHumans(userId: string): Promise<SidebarPinnedDigitalHumansState>;

  /**
   * Pins one digital human (or moves it to the most recent position when already pinned).
   *
   * @param userId Authenticated user identifier.
   * @param body Raw request payload with a single id.
   */
  postPinnedDigitalHumans(
    userId: string,
    body: PostSidebarPinnedDigitalHumansRequest
  ): Promise<SidebarPinnedDigitalHumansState>;

  /**
   * Removes one id from the pinned list when present (idempotent).
   *
   * @param userId Authenticated user identifier.
   * @param digitalHumanId Digital human identifier (from path).
   */
  deletePinnedDigitalHuman(
    userId: string,
    digitalHumanId: string
  ): Promise<SidebarPinnedDigitalHumansState>;
}

/**
 * Default {@link PinnedDigitalHumansLogic} implementation.
 */
export class DefaultPinnedDigitalHumansLogic implements PinnedDigitalHumansLogic {
  /**
   * Creates the logic with persistence and display resolution dependencies.
   *
   * @param store Pinned digital humans persistence port.
   * @param displaySource Resolves each pinned id to public display fields.
   */
  public constructor(
    private readonly store: PinnedDigitalHumansStore,
    private readonly displaySource: PinnedDigitalHumansDisplaySource
  ) {}

  /**
   * {@inheritDoc PinnedDigitalHumansLogic.getPinnedDigitalHumans}
   */
  public async getPinnedDigitalHumans(
    userId: string
  ): Promise<SidebarPinnedDigitalHumansState> {
    const stored = await this.store.getByUserId(userId);
    const { rows, keptIds } = await materializePinnedDigitalHumans(
      stored.pinned_digital_human_ids,
      this.displaySource
    );

    if (!pinnedIdListsEqual(stored.pinned_digital_human_ids, keptIds)) {
      await this.store.upsert(userId, { pinned_digital_human_ids: keptIds });
    }

    return { pinned_digital_humans: rows };
  }

  /**
   * {@inheritDoc PinnedDigitalHumansLogic.postPinnedDigitalHumans}
   */
  public async postPinnedDigitalHumans(
    userId: string,
    body: PostSidebarPinnedDigitalHumansRequest
  ): Promise<SidebarPinnedDigitalHumansState> {
    const pinId = body.pinned_digital_human_id;

    await this.displaySource.getDigitalHuman(pinId);

    const stored = await this.store.getByUserId(userId);
    const merged = mergePinToFront(stored.pinned_digital_human_ids, pinId);

    if (merged.length > MAX_PINNED_DIGITAL_HUMANS) {
      throw new HttpError(
        400,
        `at most ${MAX_PINNED_DIGITAL_HUMANS} pinned digital humans are allowed`,
        "DipStudio.PinnedDigitalHumanLimit"
      );
    }

    return this.finalizePinnedIds(userId, merged);
  }

  /**
   * {@inheritDoc PinnedDigitalHumansLogic.deletePinnedDigitalHuman}
   */
  public async deletePinnedDigitalHuman(
    userId: string,
    digitalHumanId: string
  ): Promise<SidebarPinnedDigitalHumansState> {
    const stored = await this.store.getByUserId(userId);
    const next = stored.pinned_digital_human_ids.filter((id) => id !== digitalHumanId);

    return this.finalizePinnedIds(userId, next);
  }

  /**
   * Materializes ids, persists the resolvable subset, returns the HTTP snapshot.
   */
  private async finalizePinnedIds(
    userId: string,
    candidateIds: readonly string[]
  ): Promise<SidebarPinnedDigitalHumansState> {
    const { rows, keptIds } = await materializePinnedDigitalHumans(
      candidateIds,
      this.displaySource
    );
    await this.store.upsert(userId, { pinned_digital_human_ids: keptIds });

    return { pinned_digital_humans: rows };
  }
}

/**
 * Prepends `pinId`, dropping its previous occurrence so the list stays unique and ordered by recency at the head.
 */
export function mergePinToFront(existing: readonly string[], pinId: string): string[] {
  const without = existing.filter((id) => id !== pinId);

  return [pinId, ...without];
}

/**
 * Resolves pinned ids in order, **omitting** any id whose digital human cannot be loaded (deleted, missing, or fetch error).
 *
 * @param orderedIds Normalized pinned identifiers (newest first).
 * @param displaySource Digital human resolver.
 */
export async function materializePinnedDigitalHumans(
  orderedIds: readonly string[],
  displaySource: PinnedDigitalHumansDisplaySource
): Promise<{ rows: SidebarPinnedDigitalHuman[]; keptIds: string[] }> {
  const rows: SidebarPinnedDigitalHuman[] = [];
  const keptIds: string[] = [];

  for (const id of orderedIds) {
    try {
      const d = await displaySource.getDigitalHuman(id);
      rows.push({
        id: d.id,
        name: d.name,
        creature: d.creature,
        icon_id: d.icon_id
      });
      keptIds.push(d.id);
    } catch {
      /* skip deleted or unavailable */
    }
  }

  return { rows, keptIds };
}

/**
 * Validates one digital human id from JSON or path parameters.
 *
 * @param raw Raw string-like value.
 * @returns Trimmed non-empty id.
 */
export function normalizePinnedDigitalHumanId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(
      400,
      "digital human id must be a non-empty string",
      "DipStudio.InvalidDigitalHumanId"
    );
  }

  const digitalHumanId = raw.trim();

  if (digitalHumanId.length === 0) {
    throw new HttpError(
      400,
      "digital human id must be a non-empty string",
      "DipStudio.InvalidDigitalHumanId"
    );
  }

  if (digitalHumanId.length > MAX_PINNED_DIGITAL_HUMAN_ID_LENGTH) {
    throw new HttpError(
      400,
      `digital human id must not exceed ${MAX_PINNED_DIGITAL_HUMAN_ID_LENGTH} characters`,
      "DipStudio.InvalidDigitalHumanId"
    );
  }

  return digitalHumanId;
}

function pinnedIdListsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}
