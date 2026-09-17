import { vbsErrorReason } from "@vbs/core";
import { useTranslation } from "react-i18next";

/** Maps a thrown RPC error to its copy; unknown shapes fall back to a generic. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation();
  return (error: unknown) => {
    const reason = vbsErrorReason(error);
    return reason ? t(`errors.${reason}`) : t("errors.unknown");
  };
}
