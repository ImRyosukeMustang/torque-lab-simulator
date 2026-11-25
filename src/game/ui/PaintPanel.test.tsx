import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deserialize } from "../sim/economy";
import { useGame } from "../store";
import { PaintPanel } from "./PaintPanel";

describe("Paint Shop", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    useGame.getState().resetSave();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("applies and saves paint, finish, and tint selections", () => {
    render(<PaintPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Midnight Blue" }));
    fireEvent.click(screen.getByRole("button", { name: "Matte" }));
    const tint = screen.getByLabelText("Window tint");
    for (let i = 0; i < 4; i++) fireEvent.keyDown(tint, { key: "ArrowRight" });

    expect(useGame.getState().game.cosmetics).toMatchObject({
      paint: "#16264a",
      finish: "matte",
      tint: 0.8,
    });
    expect(deserialize(localStorage.getItem("automech.save.v1")).cosmetics).toMatchObject({
      paint: "#16264a",
      finish: "matte",
      tint: 0.8,
    });
  });
});
