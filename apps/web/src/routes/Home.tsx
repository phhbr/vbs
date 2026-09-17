import { CreateSessionForm } from "../features/session/CreateSessionForm";
import { JoinByCodeForm } from "../features/session/JoinByCodeForm";

export function Home() {
  return (
    <main>
      <CreateSessionForm />
      <JoinByCodeForm />
    </main>
  );
}
