import { normalizeSessionCode } from "@vbs/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router";
import { AdminRecoveryNotice } from "../features/session/AdminRecoveryNotice";
import { JoinSessionForm } from "../features/session/JoinSessionForm";
import { SessionErrorScreen } from "../features/session/SessionError";
import { SessionScreen } from "../features/session/SessionScreen";
import {
  adminRecoveryUrl,
  readAdminTokenFromHash,
  stripHash,
} from "../features/session/adminToken";
import { useClaimAdmin, useSessionState } from "../features/session/queries";
import { useSessionRealtime } from "../features/session/realtime";

export function Session() {
  const { t } = useTranslation();
  const { code: rawCode } = useParams<{ code: string }>();
  const location = useLocation();
  const code = normalizeSessionCode(rawCode ?? "");

  const [token, setToken] = useState(() =>
    readAdminTokenFromHash(window.location.hash),
  );
  // Only the token minted by this browser's own create call is ours to display
  // rather than redeem.
  const [isOwnToken, setIsOwnToken] = useState(
    () =>
      (location.state as { justCreated?: boolean } | null)?.justCreated ??
      false,
  );
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    // A recovery link pasted while this page is already open changes only the
    // fragment, so there is no remount to pick it up. stripHash uses
    // replaceState, which does not fire this, so redeeming cannot loop.
    const onHashChange = () => {
      setToken(readAdminTokenFromHash(window.location.hash));
      setIsOwnToken(false);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const state = useSessionState(code);
  const claim = useClaimAdmin(code);
  const { mutate: claimAdmin, isIdle: claimIsIdle } = claim;

  const {
    status: connectionStatus,
    onlineParticipantIds,
    expired,
  } = useSessionRealtime({
    sessionId: state.data?.is_member ? state.data.session.id : undefined,
    participantId: state.data?.viewer?.participant_id,
  });

  useEffect(() => {
    // A token we did not just mint is one to redeem. Claiming is idempotent,
    // so a reload with the hash still present is harmless.
    if (token && !isOwnToken && claimIsIdle) {
      claimAdmin(token, { onSettled: stripHash });
    }
  }, [token, isOwnToken, claimIsIdle, claimAdmin]);

  if (!code) return <Navigate to="/" replace />;

  if (state.isPending || claim.isPending) {
    return (
      <p>{claim.isPending ? t("admin.claiming") : t("lobby.refreshing")}</p>
    );
  }

  if (claim.isError) {
    return (
      <SessionErrorScreen error={claim.error} onRetry={() => claim.reset()} />
    );
  }

  if (state.isError) {
    return (
      <SessionErrorScreen
        error={state.error}
        onRetry={() => void state.refetch()}
      />
    );
  }

  if (expired) {
    return <SessionErrorScreen error={{ code: "VB002" }} />;
  }

  if (!state.data.is_member) {
    // Say so before asking for a nickname, rather than after — same reason
    // this comes before the join form as the full-session case below.
    if (state.data.removed) {
      return <SessionErrorScreen error={{ code: "VB019" }} />;
    }
    if (state.data.session.is_full) {
      return (
        <SessionErrorScreen
          error={{ code: "VB003" }}
          onRetry={() => void state.refetch()}
        />
      );
    }
    return <JoinSessionForm code={code} />;
  }

  const showRecoveryNotice = isOwnToken && token && !noticeDismissed;

  return (
    <>
      {showRecoveryNotice && (
        <AdminRecoveryNotice
          url={adminRecoveryUrl(window.location.origin, code, token)}
          onAcknowledge={() => {
            stripHash();
            setNoticeDismissed(true);
          }}
        />
      )}
      {claim.isSuccess && <p role="status">{t("admin.claimed")}</p>}
      <SessionScreen
        code={code}
        state={state.data}
        connectionStatus={connectionStatus}
        onlineParticipantIds={onlineParticipantIds}
      />
    </>
  );
}
