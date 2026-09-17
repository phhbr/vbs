import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/s/:code" element={<Session />} />
    </Routes>
  );
}
