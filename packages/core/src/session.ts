import type { CurrentRound } from "./round";

/**
 * Shapes of the `jsonb` payloads the session RPCs return. The generated
 * database types only say `Json`, so these are maintained by hand alongside
 * the migrations that build them.
 */

export type Deck = "fibonacci" | "tshirt";
export type ParticipantRole = "admin" | "player" | "spectator";

export type SessionSummary = {
  id: string;
  code: string;
  deck: Deck;
  version: number;
  expires_at: string;
  participant_count: number;
  is_full: boolean;
};

export type SessionParticipant = {
  id: string;
  name: string;
  role: ParticipantRole;
  can_vote: boolean;
  is_you: boolean;
};

export type SessionViewer = {
  participant_id: string;
  name: string;
  role: ParticipantRole;
  can_vote: boolean;
};

/**
 * A non-member gets the summary only — `viewer`, `participants` and
 * `current_round` are null.
 */
export type SessionState = {
  session: SessionSummary;
  is_member: boolean;
  viewer: SessionViewer | null;
  participants: SessionParticipant[] | null;
  current_round: CurrentRound | null;
};

export type CreateSessionResult = {
  code: string;
  /** Returned exactly once, at creation. Only its hash is stored. */
  admin_token: string;
  locale: string;
};

export type JoinSessionResult = {
  code: string;
  participant_id: string;
  role: ParticipantRole;
  already_joined: boolean;
};

export type ClaimAdminResult = {
  code: string;
  participant_id: string;
  /** True when an existing admin row was taken over rather than promoted. */
  adopted: boolean;
};
