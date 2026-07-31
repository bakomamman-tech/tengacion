import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Trending from "../Trending";

const getFeedMock = vi.hoisted(() => vi.fn());

vi.mock("../../api", () => ({
  getFeed: getFeedMock,
}));

vi.mock("../../Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../Sidebar", () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock("../../components/seo/SeoHead", () => ({
  default: () => null,
}));

vi.mock("../../components/PostCard", () => ({
  default: ({ post }) => <article data-testid="trending-post">{post.text}</article>,
}));

const now = Date.now();
const feed = [
  {
    _id: "post-tech",
    text: "A new AI software launch for local developers",
    hashtags: ["Technology", "AI"],
    likesCount: 18,
    commentsCount: 7,
    shareCount: 3,
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    user: { _id: "followed-user" },
    name: "Ada Builder",
    username: "ada",
  },
  {
    _id: "post-business",
    text: "Small business and market lessons from Kaduna",
    hashtags: ["Business"],
    likesCount: 42,
    commentsCount: 11,
    shareCount: 8,
    createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    user: { _id: "business-user" },
    name: "Musa Founder",
    username: "musa",
  },
  {
    _id: "post-creative",
    text: "A poetry and photography collaboration",
    hashtags: ["Creative"],
    likesCount: 9,
    commentsCount: 2,
    shareCount: 1,
    createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    user: { _id: "creative-user" },
    name: "Zainab Creates",
    username: "zainab",
  },
];

describe("Trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeedMock.mockResolvedValue(feed);
  });

  it("loads real feed metrics and filters posts by topic", async () => {
    const user = userEvent.setup();
    render(<Trending user={{ following: ["followed-user"] }} />);

    expect(await screen.findByText("A new AI software launch for local developers")).toBeInTheDocument();
    expect(screen.getAllByTestId("trending-post")).toHaveLength(3);
    expect(screen.getByText("Posts in view")).toBeInTheDocument();
    expect(screen.getByText("3 posts found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Technology" }));

    expect(screen.getAllByTestId("trending-post")).toHaveLength(1);
    expect(screen.getByText("A new AI software launch for local developers")).toBeInTheDocument();
    expect(screen.queryByText("Small business and market lessons from Kaduna")).not.toBeInTheDocument();
    expect(screen.getByText("1 post found")).toBeInTheDocument();
  });

  it("supports following and text search filters without refetching the feed", async () => {
    const user = userEvent.setup();
    render(<Trending user={{ following: [{ _id: "followed-user" }] }} />);

    await screen.findByText("A new AI software launch for local developers");
    await user.click(screen.getByRole("tab", { name: /following/i }));

    expect(screen.getAllByTestId("trending-post")).toHaveLength(1);
    expect(screen.getByText("A new AI software launch for local developers")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    await user.type(screen.getByRole("searchbox", { name: /search trending posts/i }), "market");

    expect(screen.getAllByTestId("trending-post")).toHaveLength(1);
    expect(screen.getByText("Small business and market lessons from Kaduna")).toBeInTheDocument();
    expect(getFeedMock).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error state and recovers", async () => {
    const user = userEvent.setup();
    getFeedMock.mockRejectedValueOnce(new Error("Network unavailable"));

    render(<Trending user={{ following: [] }} />);

    expect(await screen.findByText("Trending is taking a moment")).toBeInTheDocument();
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();

    getFeedMock.mockResolvedValueOnce(feed);
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("trending-post")).toHaveLength(3);
    });
    expect(getFeedMock).toHaveBeenCalledTimes(2);
  });
});
