import { describe, expect, test } from "bun:test";
import { containPassengerFocus } from "../src/features/passenger/passenger-focus.ts";

function layer() {
  const docListeners = new Map();
  const rootListeners = new Map();
  const doc = {
    activeElement: null,
    defaultView: {
      getComputedStyle: (element) => ({ visibility: element.visibility ?? "visible" }),
    },
    addEventListener: (name, callback) => docListeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (docListeners.get(name) === callback) docListeners.delete(name);
    },
  };
  const root = {
    ownerDocument: doc,
    targets: [],
    contains: (target) => target === root || root.targets.includes(target),
    querySelectorAll: () => root.targets,
    addEventListener: (name, callback) => rootListeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (rootListeners.get(name) === callback) rootListeners.delete(name);
    },
    focus: () => {
      doc.activeElement = root;
    },
  };
  const button = (options = {}) => {
    const element = {
      tabIndex: 0,
      ...options,
      matches: () => !!element.disabled,
      closest: () => (element.inert || element.hidden || element.ariaHidden ? root : null),
      getClientRects: () => (element.zeroSize ? [] : [{}]),
      focus: () => {
        doc.activeElement = element;
      },
    };
    root.targets.push(element);
    return element;
  };
  const stopped = [];
  const key = (key = "Tab", options = {}) => {
    let prevented = false;
    rootListeners.get("keydown")?.({
      key,
      ...options,
      stopPropagation() {
        stopped.push(key);
      },
      preventDefault() {
        prevented = true;
      },
    });
    return prevented;
  };
  return { root, doc, button, key, stopped, docListeners, rootListeners };
}

describe("Passenger visible-layer focus", () => {
  test("initial focus and wrap in both directions never leave the visible overlay", () => {
    const host = layer();
    const first = host.button();
    const last = host.button();
    const stop = containPassengerFocus(host.root);
    expect(host.doc.activeElement).toBe(host.root);
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(first);
    expect(host.key("Tab", { shiftKey: true })).toBe(true);
    expect(host.doc.activeElement).toBe(last);
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(first);
    stop();
    expect(host.docListeners.size).toBe(0);
    expect(host.rootListeners.size).toBe(0);
  });

  test("dimmed content, disabled, hidden and negative-tabindex controls are excluded", () => {
    const host = layer();
    host.button({ inert: true });
    host.button({ disabled: true });
    host.button({ hidden: true });
    host.button({ ariaHidden: true });
    host.button({ zeroSize: true });
    host.button({ visibility: "hidden" });
    host.button({ tabIndex: -1 });
    const wake = host.button();
    const stop = containPassengerFocus(host.root, wake);
    expect(host.doc.activeElement).toBe(wake);
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(wake);
    expect(host.key("Tab", { shiftKey: true })).toBe(true);
    expect(host.doc.activeElement).toBe(wake);
    stop();
  });

  test("rotation re-queries enabled controls without rebuilding event listeners", () => {
    const host = layer();
    const first = host.button();
    const previous = host.button();
    const stop = containPassengerFocus(host.root);
    host.doc.activeElement = previous;
    host.root.targets.pop();
    const next = host.button();
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(first);
    host.doc.activeElement = next;
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(first);
    stop();
  });

  test("focus escape is contained; no controls falls back to the layer itself", () => {
    const host = layer();
    const stop = containPassengerFocus(host.root);
    host.docListeners.get("focusin")({ target: {} });
    expect(host.doc.activeElement).toBe(host.root);
    expect(host.key()).toBe(true);
    expect(host.doc.activeElement).toBe(host.root);
    expect(host.key("Escape")).toBe(false);
    expect(host.key("Tab", { ctrlKey: true })).toBe(false);
    stop();
    expect(host.docListeners.size).toBe(0);
  });

  test("focus keys and standalone Shift do not reach the global interaction listener", () => {
    const host = layer();
    const stop = containPassengerFocus(host.root);
    for (const key of ["Tab", "Shift", "ArrowDown", "Home"]) host.key(key);
    expect(host.stopped).toEqual(["Tab", "Shift", "ArrowDown", "Home"]);
    expect(host.key("Enter")).toBe(false);
    expect(host.stopped).not.toContain("Enter");
    stop();
  });

  test("repeated mount/dim/wake/unmount leaves no event listeners", () => {
    const host = layer();
    const wake = host.button();
    for (let index = 0; index < 100; index++) {
      const leaveIdle = containPassengerFocus(host.root);
      leaveIdle();
      const leaveDim = containPassengerFocus(host.root, wake);
      leaveDim();
      expect(host.docListeners.size).toBe(0);
      expect(host.rootListeners.size).toBe(0);
    }
  });
});
