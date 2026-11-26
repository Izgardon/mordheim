/**
 * jsdom has no visual viewport: a fake one a test moves as a phone's keyboard would, its height
 * and offset in CSS px, firing `resize` as the browser does.
 */
export function fakeVisualViewport(layoutHeight = 800) {
  const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
  const viewport = Object.assign(new EventTarget(), {
    height: layoutHeight,
    width: 400,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: layoutHeight });
  return {
    /** The keyboard up, covering `covered` px, the view scrolled down by `offsetTop`. */
    keyboard(covered: number, offsetTop = 0) {
      Object.assign(viewport, { height: layoutHeight - covered, offsetTop });
      viewport.dispatchEvent(new Event("resize"));
    },
    /** Pinched in: the view shows less of the page, scaled up, with nothing covered. */
    zoom(scale: number) {
      Object.assign(viewport, { height: layoutHeight / scale, scale });
      viewport.dispatchEvent(new Event("resize"));
    },
    restore() {
      if (original) Object.defineProperty(window, "visualViewport", original);
      else Reflect.deleteProperty(window, "visualViewport");
    },
  };
}
