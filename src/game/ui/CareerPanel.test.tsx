import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGame } from "../store";
import { CareerPanel } from "./CareerPanel";

describe("Career research", () => {
  beforeEach(() => {
    useGame.getState().resetSave();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows research projects and disables them until their requirements are met", () => {
    render(<CareerPanel />);

    expect(screen.getByText("Engineering research")).toBeTruthy();
    expect(screen.getByText("Ground-Effect CFD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Research · 5 RP" }).hasAttribute("disabled")).toBe(true);
  });
});
