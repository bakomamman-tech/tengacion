import { describe, expect, it } from "vitest";

import {
  getNotificationTarget,
  normalizeNotificationEntry,
} from "../notificationUtils";

describe("birthday notifications", () => {
  it("normalizes birthday system notifications and opens the focused birthday page", () => {
    const notification = normalizeNotificationEntry({
      _id: "notification-1",
      type: "system",
      text: "has a birthday today. Send them a wish!",
      sender: {
        _id: "friend-1",
        name: "Ada Friend",
        username: "ada_friend",
      },
      entity: { id: "friend-1", model: "User" },
      metadata: {
        type: "birthday",
        birthdayPersonId: "friend-1",
        link: "/birthdays?focus=friend-1",
      },
      createdAt: new Date().toISOString(),
    });

    expect(notification.type).toBe("birthday");
    expect(notification.typeLabel).toBe("Birthday");
    expect(getNotificationTarget(notification)).toEqual({
      path: "/birthdays?focus=friend-1",
    });
  });
});
