import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function Page({ title }: { title: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevCircle = false;
    const tick = () => {
      if (!alive) return;
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
      const circle = !!pad?.buttons[1]?.pressed;
      if (circle && !prevCircle) navigate("/");
      prevCircle = circle;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{title}</span>
      </header>
      <button type="button" className="back" onClick={() => navigate("/")}>
        Back
      </button>
    </div>
  );
}