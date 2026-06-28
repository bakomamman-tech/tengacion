import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BlockDrop from "../BlockDrop";
import NightRaid from "../NightRaid";
import WordSprint from "../WordSprint";

describe("new live gaming lanes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lets Night Raid move and fire from its close control deck", async () => {
    const onSessionChange = vi.fn();
    render(<NightRaid onSessionChange={onSessionChange} />);

    fireEvent.click(screen.getByRole("button", { name: /right/i }));
    expect(screen.getByText(/Shifted to lane 4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fire pulse/i }));
    expect(screen.getByText(/Pulse missed/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(onSessionChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ game: "night-raid", moves: 2 })
      )
    );
  });

  it("scores a correct Word Sprint answer and advances the clue", async () => {
    const onSessionChange = vi.fn();
    render(<WordSprint onSessionChange={onSessionChange} />);

    fireEvent.click(screen.getByRole("button", { name: /start sprint/i }));
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: "rhythm" } });
    fireEvent.click(screen.getByRole("button", { name: /lock answer/i }));

    expect(screen.getByText(/Correct for/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(onSessionChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ game: "word-sprint", solved: 1, streak: 1 })
      )
    );
  });

  it("places a Block Drop shape and banks the move locally", async () => {
    const onSessionChange = vi.fn();
    render(<BlockDrop onSessionChange={onSessionChange} />);

    fireEvent.click(screen.getByRole("button", { name: /place at row 1, column 1/i }));

    expect(screen.getByText(/shape placed|lines? cleared for/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(onSessionChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ game: "block-drop", moves: 1 })
      )
    );
    expect(JSON.parse(localStorage.getItem("tengacion.gaming.block-drop.state"))).toEqual(
      expect.objectContaining({ pieces: 1 })
    );
  });
});
