import { normalizeSessionCode } from "@vbs/core";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import { JoinSessionForm } from "../features/session/JoinSessionForm";
import { Lobby } from "../features/session/Lobby";
import { SessionErrorScreen } from "../features/session/SessionError";
import { useSessionState } from "../features/session/queries";

export function Session() {
  const { t } = useTranslation();
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeSessionCode(rawCode ?? "");
  const state = useSessionState(code);

  if (!code) return <Navigate to="/" replace />;

  if (state.isPending) return <p>{t("lobby.refreshing")}</p>;

  // Unknown code, expired session and the rest arrive as typed errors and get
  // their own screen with a way forward.
  if (state.isError) {
    return (
      <SessionErrorScreen
        error={state.error}
        onRetry={() => void state.refetch()}
      />
    );
  }

  if (!state.data.is_member) {
    // Say so before asking for a nickname, rather than after.
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

  return (
    <Lobby
      state={state.data}
      shareUrl={`${window.location.origin}/s/${code}`}
      onRefresh={() => void state.refetch()}
      isRefreshing={state.isFetching}
    />
  );
}
