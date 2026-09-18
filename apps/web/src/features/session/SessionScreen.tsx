import type { SessionState } from "@vbs/core";
import { formatSessionCode } from "@vbs/core";
import { Footer, NavTabs, StatusBar } from "@vbs/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { RoundHistory } from "../round/RoundHistory";
import { RoundScreen } from "../round/RoundScreen";
import { useRoundHistory } from "../round/queries";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { ConfirmAction } from "./ConfirmAction";
import { useExpiryStatus } from "./expiry";
import { useLeaveSession } from "./queries";
import type { ConnectionStatus } from "./realtime";
import { RulesTab } from "./RulesTab";
import { useErrorMessage } from "./useErrorMessage";
import styles from "./SessionScreen.module.css";

type Tab = "main" | "history" | "rules";

export function SessionScreen({
  code,
  state,
  connectionStatus,
  onlineParticipantIds,
}: {
  code: string;
  state: SessionState;
  connectionStatus: ConnectionStatus;
  onlineParticipantIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("main");
  const history = useRoundHistory(state.session.id);
  const expiry = useExpiryStatus(state.session.expires_at);
  const leaveSession = useLeaveSession(code);
  useDocumentTitle(`${t("app.title")} — ${t("session.heading")}`);

  const shareUrl = `${window.location.origin}/s/${code}`;
  const roundsPlayed = (history.data ?? []).filter((r) => r.result).length;
  const deckLabel =
    state.session.deck === "tshirt"
      ? t("round.deckLabelTshirt")
      : t("round.deckLabelFibonacci");
  const latestRoundNumber =
    state.current_round?.round_number ?? history.data?.[0]?.round_number ?? 0;

  const tabs = [
    { id: "main", label: t("session.navMain") },
    { id: "history", label: t("session.navHistory") },
    { id: "rules", label: t("session.navRules") },
  ] as const;

  return (
    <main className="page-main">
      <h1 className="page-heading">{t("session.heading")}</h1>
      <p aria-live="polite">
        {connectionStatus === "connected"
          ? t("lobby.connected")
          : t("lobby.reconnecting")}
      </p>

      <NavTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
        ariaLabel={t("session.navLabel")}
      />

      <StatusBar
        ariaLabel={t("session.statusBarLabel")}
        items={[
          {
            label: t("round.statusSession"),
            value: formatSessionCode(state.session.code),
          },
          { label: t("round.statusRounds"), value: roundsPlayed },
          { label: t("round.statusDeck"), value: deckLabel },
          {
            label: t("round.statusTeam"),
            value: t("round.teamCount", {
              count: state.session.participant_count,
            }),
          },
          { label: t("round.statusExpires"), value: expiry.formatted },
        ]}
      />

      {expiry.isNear && (
        <p role="status" aria-live="polite" className={styles.expiryWarning}>
          {t("session.expiryWarning")}
        </p>
      )}

      {leaveSession.error !== null && (
        <p role="alert">{describeError(leaveSession.error)}</p>
      )}

      {tab === "main" && (
        <RoundScreen
          code={code}
          state={state}
          onlineParticipantIds={onlineParticipantIds}
          shareUrl={shareUrl}
          onShowHistory={() => setTab("history")}
        />
      )}

      {tab === "history" && (
        <div
          id="tabpanel-history"
          role="tabpanel"
          aria-labelledby="tab-history"
        >
          <RoundHistory sessionId={state.session.id} />
        </div>
      )}

      {tab === "rules" && (
        <div id="tabpanel-rules" role="tabpanel" aria-labelledby="tab-rules">
          <RulesTab />
        </div>
      )}

      <Footer
        segments={[
          "VBS",
          formatSessionCode(state.session.code),
          t("session.footerRound", { n: latestRoundNumber }),
        ]}
        action={
          <ConfirmAction
            label={t("session.footerLeave")}
            confirmQuestion={t("session.leaveConfirm")}
            confirmLabel={t("session.leaveConfirmYes")}
            cancelLabel={t("session.leaveConfirmNo")}
            disabled={leaveSession.isPending}
            onConfirm={() =>
              leaveSession.mutate(undefined, {
                onSuccess: () => void navigate("/"),
              })
            }
          />
        }
      />
    </main>
  );
}
