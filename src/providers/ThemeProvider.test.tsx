import { act, render, screen } from "@testing-library/react";
import {
  THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from "@/providers/ThemeProvider";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme}
    </button>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("usa dark como padrao e aplica a classe no html", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("restaura o tema salvo localmente e alterna para light", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button")).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");

    act(() => screen.getByRole("button").click());
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignora valor invalido salvo localmente", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });
});
