import { useEffect, useRef, useState, type ReactNode } from "react";

export type PopupAction = {
  label: string;
  onSelect: () => void;
};

export function Popup({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  actions: PopupAction[];
  onClose: () => void;
}) {
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const typing = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement).tagName === "INPUT";
      if (e.key === "Escape") onClose();
      if (inField) return;
      if (e.key === "ArrowUp") setFocused((f) => (f - 1 + actions.length) % actions.length);
      if (e.key === "ArrowDown") setFocused((f) => (f + 1) % actions.length);
      if (e.key === "Enter") actions[focusedRef.current]?.onSelect();
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevUp = false;
    let prevDown = false;
    let prevCross = false;
    let prevClose = false;
    let armed = false;

    const tick = () => {
      if (!alive) return;
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
      if (pad && !typing.current) {
        const up = (pad.axes[1] ?? 0) < -0.6 || !!pad.buttons[12]?.pressed;
        const down = (pad.axes[1] ?? 0) > 0.6 || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;

        if (!cross && !circle) armed = true;
        if (armed && up && !prevUp) setFocused((f) => (f - 1 + actions.length) % actions.length);
        if (armed && down && !prevDown) setFocused((f) => (f + 1) % actions.length);
        if (armed && cross && !prevCross) actions[focusedRef.current]?.onSelect();
        if (armed && circle && !prevClose) onClose();

        prevUp = up;
        prevDown = down;
        prevCross = cross;
        prevClose = circle;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [actions, onClose]);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <section className="popup" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="popup-title">{title}</header>
        {children && <div className="popup-body">{children}</div>}
        <div className="popup-actions">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              className={i === focused ? "menu-item focused" : "menu-item"}
              onMouseEnter={() => setFocused(i)}
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}