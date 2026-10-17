import { generateFallbackRoll, parseDiceValues } from "./dice-utils";

/** The parts of the (untyped) @3d-dice/dice-box instance this module uses. */
type DiceBoxInstance = {
  canvas?: HTMLCanvasElement;
  init: () => Promise<unknown>;
  roll: (notation: string, options?: { themeColor?: string }) => Promise<unknown>;
  clear: () => void;
  resizeWorld: () => void;
};

type DiceBoxConstructor = new (config: Record<string, unknown>) => DiceBoxInstance;

export type DiceEngine = {
  /** Downloads and initialises dice-box once; later calls share the same instance. */
  load: () => Promise<void>;
  /** Rolls in the 3D overlay and resolves with the die values (random values as a fallback). */
  roll: (notation: string, themeColor?: string) => Promise<number[]>;
  /** Removes the dice from the table. */
  clear: () => void;
  /** Terminates the physics worker, drops the WebGL context and the resize listener. */
  destroy: () => void;
};

type DiceEngineOptions = {
  /** Selector of the element dice-box appends its canvas to. */
  container: string;
  assetPath: string;
  loadDiceBox?: () => Promise<DiceBoxConstructor>;
};

const importDiceBox = async () => (await import("@3d-dice/dice-box")).default as DiceBoxConstructor;

/**
 * dice-box 1.1 has no destroy(): its physics Worker and window resize listener are private. Both
 * are created synchronously inside calls we make, so we record them there to release them later.
 */
function recordWorkers<T>(workers: Worker[], start: () => T): T {
  const NativeWorker = typeof window !== "undefined" ? window.Worker : undefined;
  if (typeof NativeWorker !== "function") {
    return start();
  }
  window.Worker = class RecordedWorker extends NativeWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) {
      super(...args);
      workers.push(this);
    }
  };
  try {
    return start();
  } finally {
    window.Worker = NativeWorker;
  }
}

function recordResizeListeners(instance: DiceBoxInstance, listeners: EventListener[]) {
  const resizeWorld = instance.resizeWorld.bind(instance);
  instance.resizeWorld = () => {
    const nativeAddEventListener = window.addEventListener;
    window.addEventListener = function (
      this: Window,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type === "resize" && typeof listener === "function") {
        listeners.push(listener);
      }
      nativeAddEventListener.call(this, type, listener, options);
    } as typeof window.addEventListener;
    try {
      resizeWorld();
    } finally {
      window.addEventListener = nativeAddEventListener;
    }
  };
}

function loseWebGLContext(canvas: HTMLCanvasElement) {
  try {
    // Returns the context the engine already created; asking never creates a second type.
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Best effort: the canvas is removed either way.
  }
}

export function createDiceEngine({
  container,
  assetPath,
  loadDiceBox = importDiceBox,
}: DiceEngineOptions): DiceEngine {
  let box: DiceBoxInstance | null = null;
  let loading: Promise<DiceBoxInstance> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let destroyed = false;
  const workers: Worker[] = [];
  const resizeListeners: EventListener[] = [];

  const release = (instance: DiceBoxInstance | null, { hadContext }: { hadContext: boolean }) => {
    resizeListeners.splice(0).forEach((listener) => {
      window.removeEventListener("resize", listener);
    });
    workers.splice(0).forEach((worker) => worker.terminate());
    const canvas = instance?.canvas;
    if (canvas) {
      if (hadContext) {
        loseWebGLContext(canvas);
      }
      canvas.remove();
    }
  };

  const loadInstance = () => {
    loading ??= (async () => {
      const DiceBox = await loadDiceBox();
      if (destroyed) {
        throw new Error("The dice engine was destroyed while loading.");
      }
      const instance = new DiceBox({ container, assetPath, offscreen: false });
      recordResizeListeners(instance, resizeListeners);
      try {
        await recordWorkers(workers, () => instance.init());
      } catch (error) {
        release(instance, { hadContext: false });
        throw error;
      }
      if (destroyed) {
        release(instance, { hadContext: true });
        throw new Error("The dice engine was destroyed while loading.");
      }
      box = instance;
      return instance;
    })().catch((error: unknown) => {
      // A failed download or init can be retried by the next roll.
      loading = null;
      throw error;
    });
    return loading;
  };

  const rollOnce = async (notation: string, themeColor?: string) => {
    let instance: DiceBoxInstance;
    try {
      instance = await loadInstance();
    } catch (error) {
      console.error("Failed to initialize DiceBox, using fallback rolls", error);
      return generateFallbackRoll(notation);
    }
    try {
      const values = parseDiceValues(await instance.roll(notation, { themeColor }));
      return values.length > 0 ? values : generateFallbackRoll(notation);
    } catch (error) {
      console.error("Dice roll failed, using fallback", error);
      return generateFallbackRoll(notation);
    }
  };

  return {
    load: () => loadInstance().then(() => undefined),
    roll: (notation, themeColor) => {
      // One table: a new roll waits for the previous one instead of clearing it mid-throw.
      const next = queue.then(() => rollOnce(notation, themeColor));
      queue = next.catch(() => undefined);
      return next;
    },
    clear: () => {
      try {
        box?.clear();
      } catch {
        // Clearing is cosmetic.
      }
    },
    destroy: () => {
      destroyed = true;
      release(box, { hadContext: Boolean(box) });
      box = null;
    },
  };
}
