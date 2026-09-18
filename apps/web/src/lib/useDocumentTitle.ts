import { useEffect } from "react";

/** Keeps <title> in the active locale, re-applied on every language change. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
