import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("shows the tested contract recipe and exact tune settings", () => {
    render(<CareerPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Exact pass guide" }));

    expect(screen.getByText("Verified build and tune")).toBeTruthy();
    expect(screen.getByText("Cold Air Intake")).toBeTruthy();
    expect(screen.getByText("Street Cams 256°")).toBeTruthy();
    expect(screen.getByText("0.10 bar")).toBeTruthy();
    expect(screen.getByText("0.85 λ")).toBeTruthy();
  });
});
