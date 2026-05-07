/**
 * One pinned row for the Studio sidebar after server-side composition (OpenAPI `SidebarPinnedDigitalHuman`).
 * Only resolvable digital humans are returned; deleted or unreachable ids are filtered out earlier.
 */
export interface SidebarPinnedDigitalHuman {
  /**
   * Digital human identifier.
   */
  id: string;

  /**
   * Human-readable name from the digital human profile.
   */
  name: string;

  /**
   * Job position / role label (IDENTITY.md Creature).
   */
  creature?: string;

  /**
   * Icon identifier (IDENTITY.md Icon ID).
   */
  icon_id?: string;
}

/**
 * Sidebar pinned digital humans response body (OpenAPI `SidebarPinnedDigitalHumansState`).
 * Display fields are composed by the server; entries only include resolvable digital humans
 * (deleted or unreachable ids are omitted and trimmed from storage).
 */
export interface SidebarPinnedDigitalHumansState {
  /**
   * Pinned employees in sidebar display order (top-to-bottom = add-time descending; index 0 = most recently pinned).
   */
  pinned_digital_humans: SidebarPinnedDigitalHuman[];
}

/**
 * Normalized ids persisted in `t_studio_user_preference.pinned_digital_human_ids` (internal / DB layer).
 */
export interface PinnedDigitalHumanIdsStored {
  pinned_digital_human_ids: string[];
}

/**
 * Request body for pinning one digital human (OpenAPI `PostSidebarPinnedDigitalHumansRequest`).
 */
export interface PostSidebarPinnedDigitalHumansRequest {
  /**
   * Id to pin or re-pin to the top of the sidebar list.
   */
  pinned_digital_human_id: string;
}
