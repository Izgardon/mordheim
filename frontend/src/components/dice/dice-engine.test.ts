import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDiceEngine } from "./dice-engine";

const created: FakeDiceBox[] = [];
const onResize = vi.fn();

class FakeDiceBox {
  canvas = document.createElement("canvas");
  init = vi.fn(async () => {
    // Like dice-box: a physics worker is created synchronously, then the world is sized.
    new window.Worker("data:application/javascript,");
    this.resizeWorld();
    return this;
  });
  roll = vi.fn(async (notation: string) =>
    notation === "2d6" ? [{ value: 3 }, { value: 5 }] : [{ value: 4 }]
  );
  clear = vi.fn();

  loseContext = vi.fn();

  constructor(public config: Record<string, unknown>) {
    created.push(this);
    // jsdom has no WebGL; hand back a context that records being released.
    const gl = { getExtension: () => ({ loseContext: this.loseContext }) };
    this.canvas.getContext = vi.fn(() => gl) as unknown as HTMLCanvasElement["getContext"];
    document.body.appendChild(this.canvas);
  }

  resizeWorld() {
    window.addEventListener("resize", onResize);
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}

const loadDiceBox = vi.fn(async () => FakeDiceBox);

const makeEngine = () =>
  createDiceEngine({ container: "#dice", assetPath: "/assets/dice-box/", loadDiceBox });

describe("createDiceEngine", () => {
  const nativeWorker = window.Worker;

  beforeEach(() => {
    created.length = 0;
    FakeWorker.instances = [];
    loadDiceBox.mockClear();
    onResize.mockClear();
    window.Worker = FakeWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    window.Worker = nativeWorker;
    window.removeEventListener("resize", onResize);
    vi.restoreAllMocks();
  });

  it("loads dice-box once and reuses one engine for every roll", async () => {
    const engine = makeEngine();

    engine.load();
    expect(await engine.roll("2d6", "#123456")).toEqual([3, 5]);
    expect(await engine.roll("1d6")).toEqual([4]);

    expect(loadDiceBox).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0].config).toMatchObject({ container: "#dice", offscreen: false });
    expect(created[0].roll).toHaveBeenNthCalledWith(1, "2d6", { themeColor: "#123456" });
  });

  it("releases the worker, the resize listener and the WebGL canvas on destroy", async () => {
    const engine = makeEngine();
    await engine.load();
    const [worker] = FakeWorker.instances;
    expect(worker).toBeDefined();
    expect(window.Worker).toBe(FakeWorker); // the recording wrapper is removed after init

    engine.destroy();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("resize"));
    expect(onResize).not.toHaveBeenCalled();
    expect(created[0].loseContext).toHaveBeenCalledTimes(1);
    expect(created[0].canvas.isConnected).toBe(false);
  });

  it("falls back to random values when dice-box fails to load, and retries next time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadDiceBox.mockRejectedValueOnce(new Error("chunk failed"));
    const engine = makeEngine();

    const values = await engine.roll("3d6");
    expect(values).toHaveLength(3);
    values.forEach((value) => expect(value).toBeGreaterThanOrEqual(1));
    values.forEach((value) => expect(value).toBeLessThanOrEqual(6));

    expect(await engine.roll("2d6")).toEqual([3, 5]);
    expect(loadDiceBox).toHaveBeenCalledTimes(2);
  });

  it("runs overlapping rolls one after the other on the shared table", async () => {
    const engine = makeEngine();
    await engine.load();
    let release!: () => void;
    created[0].roll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([{ value: 6 }]);
        })
    );

    const first = engine.roll("1d6");
    const second = engine.roll("2d6");
    await vi.waitFor(() => expect(created[0].roll).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(created[0].roll).toHaveBeenCalledTimes(1);

    release();
    expect(await first).toEqual([6]);
    expect(await second).toEqual([3, 5]);
  });
});
