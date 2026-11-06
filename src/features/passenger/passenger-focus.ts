/** Keep keyboard focus within the visible Passenger layer; never changes navigation or timers. */
export function containPassengerFocus(root: HTMLElement, fallback: HTMLElement = root) {
  const doc = root.ownerDocument;
  const focusFallback = () => fallback.focus({ preventScroll: true });
  const onFocus = (event: FocusEvent) => {
    if (!root.contains(event.target as Node)) focusFallback();
  };
  const onKey = (event: KeyboardEvent) => {
    // Shift+Tab also emits a standalone Shift keydown. Focus browsing and modifiers
    // must not reach the Console's global first-interaction listener while Idle.
    if (
      [
        "Tab",
        "Shift",
        "Control",
        "Alt",
        "Meta",
        "AltGraph",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(event.key)
    )
      event.stopPropagation();
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    // Re-query for rotating content and controls that become enabled/disabled.
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"),
    ).filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
        element.getClientRects().length > 0 &&
        doc.defaultView?.getComputedStyle(element).visibility !== "hidden",
    );
    const first = targets[0];
    const last = targets.at(-1);
    const current = doc.activeElement;
    if (!first || !last) {
      event.preventDefault();
      focusFallback();
    } else if (event.shiftKey && (current === first || !targets.includes(current as HTMLElement))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (current === last || !targets.includes(current as HTMLElement))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  doc.addEventListener("focusin", onFocus);
  root.addEventListener("keydown", onKey);
  focusFallback();
  return () => {
    doc.removeEventListener("focusin", onFocus);
    root.removeEventListener("keydown", onKey);
  };
}
