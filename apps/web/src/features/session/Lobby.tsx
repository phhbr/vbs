import type { SessionState } from "@vbs/core";
import { formatSessionCode } from "@vbs/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionStatus } from "./realtime";
import { SessionQr } from "./SessionQr";

function ShareLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <p>
      {t("lobby.link")}: <a href={url}>{url}</a>{" "}
      <button type="button" onClick={copy}>
        {copied ? t("lobby.copied") : t("lobby.copy")}
      </button>
    </p>
  );
}

export function Lobby({
  state,
  shareUrl,
  onRefresh,
  isRefreshing,
  connectionStatus,
}: {
  state: SessionState;
  shareUrl: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  connectionStatus: ConnectionStatus;
}) {
  const { t } = useTranslation();
  const participants = state.participants ?? [];

  return (
    <>
      <h1>{t("lobby.title")}</h1>
      {/* aria-live, not role="status": this page already has one status
          region (the admin-claim announcement), and role="status" is itself
          an implicit polite live region, so this achieves the same
          announcement without a second ambiguous status landmark. */}
      <p aria-live="polite">
        {connectionStatus === "connected"
          ? t("lobby.connected")
          : t("lobby.reconnecting")}
      </p>
      {!state.current_round && <p>{t("lobby.waiting")}</p>}

      <p>
        {t("lobby.code")}:{" "}
        <strong>{formatSessionCode(state.session.code)}</strong>
      </p>

      <ShareLink url={shareUrl} />
      <SessionQr url={shareUrl} />

      <section>
        <h2>{t("lobby.participants")}</h2>
        <p>
          {t("lobby.participantCount", {
            count: state.session.participant_count,
          })}
        </p>
        {/* Roles and arrivals change under the reader, so announce politely. */}
        <ul aria-live="polite">
          {participants.map((participant) => (
            <li key={participant.id}>
              {participant.name} — {participant.role}
              {participant.is_you ? ` (${t("lobby.you")})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <p>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? t("lobby.refreshing") : t("lobby.refresh")}
        </button>
      </p>
    </>
  );
}
