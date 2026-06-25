/**
 * Minimal DOM shim for Bun unit tests that need `document`.
 * Provides enough surface for `overlay-detection.shared.ts`
 * (querySelector + body.innerHTML) without pulling in happy-dom/jsdom.
 *
 * Supports a subset of `querySelector` — class selectors (`.foo`) and
 * tag selectors (`div`) — sufficient for the overlay-detection tests.
 *
 * Loaded via `bunfig.toml` → `test.preload` so it runs before any test module.
 */
if (typeof globalThis.document === "undefined") {
  const TAG_REGEX = /<(\w+)([^>]*)>/g;
  const CLASS_REGEX = /class="([^"]*)"/;
  const WHITESPACE_REGEX = /\s+/;

  function parseHTML(html: string): { tag: string; classes: string[] }[] {
    const elements: { tag: string; classes: string[] }[] = [];
    TAG_REGEX.lastIndex = 0;
    let match = TAG_REGEX.exec(html);
    while (match !== null) {
      const tag = match[1];
      const attrs = match[2];
      const classMatch = attrs.match(CLASS_REGEX);
      const classes = classMatch ? classMatch[1].split(WHITESPACE_REGEX) : [];
      elements.push({ tag, classes });
      match = TAG_REGEX.exec(html);
    }
    return elements;
  }

  function querySelectorIn(
    elements: { tag: string; classes: string[] }[],
    selector: string
  ): { tag: string; classes: string[] } | null {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return elements.find((el) => el.classes.includes(className)) ?? null;
    }
    return elements.find((el) => el.tag === selector) ?? null;
  }

  const state = { html: "" };

  function createTestElement() {
    return {
      innerHTML: "",
      appendChild: () => undefined,
      querySelector: () => null,
    };
  }

  const body = {
    get innerHTML() {
      return state.html;
    },
    set innerHTML(value: string) {
      state.html = value;
    },
  };

  const head = {
    appendChild: () => undefined,
  };

  Object.defineProperty(globalThis, "document", {
    value: {
      head,
      get body() {
        return body;
      },
      querySelector(selector: string) {
        const elements = parseHTML(state.html);
        return querySelectorIn(elements, selector);
      },
      documentElement: body,
      createElement: createTestElement,
      createTextNode: () => ({}),
    },
    writable: true,
    configurable: true,
  });
}
