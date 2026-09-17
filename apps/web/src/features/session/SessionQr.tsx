import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

/**
 * A real QR code of the share link, at least 160 px as STYLE.md requires. The
 * image is decorative — the same link is right next to it as selectable text —
 * so it carries an empty alt and the caption does the describing.
 */
export function SessionQr({ url }: { url: string }) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 192, margin: 1 }).then(
      (generated) => active && setDataUrl(generated),
      () => active && setDataUrl(null),
    );
    return () => {
      active = false;
    };
  }, [url]);

  if (!dataUrl) return null;

  return (
    <figure>
      <img src={dataUrl} alt="" width={192} height={192} />
      <figcaption>{t("lobby.qrCaption")}</figcaption>
    </figure>
  );
}
