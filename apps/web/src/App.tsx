import { useTheme } from "@vbs/ui";
import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";

export function App() {
  const [theme, setTheme] = useTheme();

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? "Dunkel" : "Hell"}
      </button>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:code" element={<Session />} />
      </Routes>
    </>
  );
}
