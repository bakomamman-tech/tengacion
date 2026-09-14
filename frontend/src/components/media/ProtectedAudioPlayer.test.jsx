import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ProtectedAudioPlayer from "./ProtectedAudioPlayer";

it("plays without a native download menu and preserves preview boundary handlers", async () => {
  const ref = createRef();
  const onTimeUpdate = vi.fn(event => { if (event.currentTarget.currentTime > 30) { event.currentTarget.currentTime = 30; } });
  const {container} = render(<ProtectedAudioPlayer ref={ref} src="/preview" controls onTimeUpdate={onTimeUpdate} />);
  const audio = container.querySelector("audio");
  expect(ref.current).toBe(audio);
  expect(audio.controls).toBe(false);
  expect(screen.queryByRole("link", {name: /download/i})).toBeNull();
  audio.play = vi.fn().mockResolvedValue();
  fireEvent.click(screen.getByRole("button", {name: "Play audio"}));
  await waitFor(() => expect(audio.play).toHaveBeenCalledOnce());
  Object.defineProperty(audio, "duration", {value: 100, configurable: true});
  fireEvent.loadedMetadata(audio);
  fireEvent.change(screen.getByRole("slider", {name: "Audio position"}), {target: {value: "40"}});
  fireEvent.timeUpdate(audio);
  expect(onTimeUpdate).toHaveBeenCalledOnce();
  expect(audio.currentTime).toBe(30);
  expect(screen.getByRole("slider", {name: "Audio position"})).toHaveValue("30");
});

it("reports rejected playback and disables playback without a source", async () => {
  const {container, rerender} = render(<ProtectedAudioPlayer src="/preview" />);
  container.querySelector("audio").play = vi.fn().mockRejectedValue(new Error("unavailable"));
  fireEvent.click(screen.getByRole("button", {name: "Play audio"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Audio could not play");
  rerender(<ProtectedAudioPlayer />);
  expect(screen.getByRole("button", {name: "Play audio"})).toBeDisabled();
});
