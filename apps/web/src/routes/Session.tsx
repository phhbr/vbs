import { useParams } from "react-router";

export function Session() {
  const { code } = useParams<{ code: string }>();

  return (
    <main>
      <p>Session {code} — Platzhalter</p>
    </main>
  );
}
