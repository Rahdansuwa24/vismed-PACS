import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Aktifkan tema ${isLight ? "gelap" : "terang"}`}
      title={`Aktifkan tema ${isLight ? "gelap" : "terang"}`}
    >
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
      <span>{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}
