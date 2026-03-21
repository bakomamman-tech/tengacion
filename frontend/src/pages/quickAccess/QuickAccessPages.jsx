import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

import QuickAccessLayout from "../../components/QuickAccessLayout";
import { apiRequest, getFriendsHub, resolveImage, sendChatMessage } from "../../api";

const FRIENDS = [
  "Damilola Grant",
  "Seyi Okon",
  "Miriam Akin",
  "Lilian Ugo",
  "Timi Gold",
  "Ada Nkem",
];

const FRIEND_SUGGESTIONS = [
  "Jesse Manu",
  "Bola Tamuno",
  "Nelly Jude",
  "Arielle Dan",
  "Mark Dike",
  "King Lu",
];

const GROUP_SHARE_STORAGE_KEY = "tengacion:group-shares";
const BIRTHDAY_WISH_PRESETS = [
  "Happy birthday! Wishing you joy and more life.",
  "More grace, peace, and beautiful moments this year.",
  "Celebrate big today. Your new year will be full of wins.",
];

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const normalizeShareDraft = (value = {}) => {
  const postId = String(value?.postId || "").trim();
  const url = String(value?.url || "").trim();
  if (!postId || !url) {
    return null;
  }

  return {
    postId,
    url,
    note: String(value?.note || "").trim(),
    authorName: String(value?.authorName || "Tengacion creator").trim(),
    authorUsername: String(value?.authorUsername || "").trim().replace(/^@+/, ""),
    excerpt: String(value?.excerpt || "").trim(),
    previewImage: String(value?.previewImage || "").trim(),
  };
};

const readStoredGroupShares = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(GROUP_SHARE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredGroupShares = (value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(GROUP_SHARE_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Ignore storage errors for this lightweight share handoff.
  }
};

function SectionCard({ title, action, children }) {
  return (
    <section className="card quick-section-card">
      <div className="quick-section-head">
        <h2>{title}</h2>
        {action || null}
      </div>
      {children}
    </section>
  );
}

export function FriendsPage({ user }) {
  const [query, setQuery] = useState("");

  const filteredFriends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return FRIENDS;
    }
    return FRIENDS.filter((name) => name.toLowerCase().includes(needle));
  }, [query]);

  return (
    <QuickAccessLayout
      user={user}
      title="Friends"
      subtitle="Manage your connections and discover people you may know."
    >
      <SectionCard title="Your friends">
        <input
          className="quick-inline-input"
          placeholder="Search friends"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="quick-list-grid">
          {filteredFriends.map((name) => (
            <article key={name} className="quick-list-item">
              <strong>{name}</strong>
              <span>Connected on Tengacion</span>
              <button type="button">Message</button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="People you may know">
        <div className="quick-list-grid two-col">
          {FRIEND_SUGGESTIONS.map((name) => (
            <article key={name} className="quick-list-item">
              <strong>{name}</strong>
              <span>3 mutual friends</span>
              <button type="button">Add friend</button>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function ProfessionalDashboardPage({ user }) {
  const cards = [
    { label: "Posts", value: 126, note: "+8 this week" },
    { label: "Followers", value: 4812, note: "+3.2%" },
    { label: "Engagement", value: "8.6%", note: "Above average" },
    { label: "Messages", value: 42, note: "Needs response" },
  ];

  const recentActivity = [
    "Your latest post reached 2,430 people.",
    "5 new followers from creator playlist.",
    "3 comments waiting for moderation.",
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Professional Dashboard"
      subtitle="Track your audience growth and publishing performance."
    >
      <SectionCard title="Performance snapshot">
        <div className="quick-stats-grid">
          {cards.map((item) => (
            <article key={item.label} className="quick-stat-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent activity">
        <ul className="quick-timeline">
          {recentActivity.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function MemoriesPage({ user }) {
  const memories = [
    { date: "March 1, 2025", text: "You shared your first live session highlight." },
    { date: "March 1, 2024", text: "Your song teaser crossed 10k plays." },
    { date: "March 1, 2023", text: "You joined Tengacion." },
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Memories"
      subtitle="Revisit moments from this day in previous years."
    >
      <SectionCard title="On this day">
        <div className="quick-memories-line">
          {memories.map((entry) => (
            <article key={entry.date} className="quick-memory-item">
              <strong>{entry.date}</strong>
              <p>{entry.text}</p>
              <button type="button">Share memory</button>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function SavedPage({ user }) {
  const [filter, setFilter] = useState("Posts");
  const filters = ["Posts", "Videos", "Links"];
  const items = [
    { type: "Posts", title: "Creator tips for better livestream quality" },
    { type: "Videos", title: "Studio workflow in 90 seconds" },
    { type: "Links", title: "Music distribution checklist" },
    { type: "Posts", title: "How to grow your audience in 30 days" },
  ];

  const visible = items.filter((item) => item.type === filter);

  return (
    <QuickAccessLayout
      user={user}
      title="Saved"
      subtitle="Everything you bookmarked in one place."
    >
      <SectionCard
        title="Saved items"
        action={
          <div className="quick-filter-chips">
            {filters.map((entry) => (
              <button
                key={entry}
                type="button"
                className={filter === entry ? "active" : ""}
                onClick={() => setFilter(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        }
      >
        <div className="quick-list-grid">
          {visible.map((item, index) => (
            <article key={`${item.title}-${index}`} className="quick-list-item">
              <strong>{item.title}</strong>
              <span>{item.type}</span>
              <button type="button">Open</button>
            </article>
          ))}
          {visible.length === 0 && <p className="quick-empty">No items in this filter yet.</p>}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function GroupsPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const shareDraft = normalizeShareDraft(location.state?.sharePost);
  const [groupShares, setGroupShares] = useState(() => readStoredGroupShares());

  const groups = [
    {
      id: "artists-hub",
      name: "Tengacion Artists Hub",
      note: "Active this week",
    },
    {
      id: "afrobeat-producers",
      name: "Afrobeat Producers",
      note: "Beat swaps and sessions",
    },
    {
      id: "live-session-organizers",
      name: "Live Session Organizers",
      note: "Planning the next stage run",
    },
    {
      id: "songwriters-community",
      name: "Songwriters Community",
      note: "Lyrics, hooks, and drafts",
    },
  ];

  const handleGroupShare = async (group) => {
    if (!shareDraft?.postId) {
      return;
    }

    try {
      await apiRequest(`/api/posts/${encodeURIComponent(shareDraft.postId)}/share`, {
        method: "POST",
      }).catch(() => null);

      let copied = false;
      try {
        await navigator.clipboard.writeText(shareDraft.url);
        copied = true;
      } catch {
        copied = false;
      }

      const nextShares = {
        ...groupShares,
        [group.id]: {
          postId: shareDraft.postId,
          groupName: group.name,
          sharedAt: new Date().toISOString(),
        },
      };
      setGroupShares(nextShares);
      writeStoredGroupShares(nextShares);
      toast.success(
        copied
          ? `Shared to ${group.name}. Link copied for the group.`
          : `Shared to ${group.name}.`
      );
    } catch (err) {
      toast.error(err?.message || "Failed to share to this group");
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Groups"
      subtitle="Discover and manage your creative communities."
    >
      {shareDraft ? (
        <section className="card quick-section-card quick-share-banner">
          <div className="quick-share-banner__content">
            <p className="quick-share-banner__eyebrow">Group share</p>
            <strong>
              {shareDraft.authorName}
              {shareDraft.authorUsername ? ` @${shareDraft.authorUsername}` : ""}
            </strong>
            <p>
              {shareDraft.note || shareDraft.excerpt || "Choose one of your groups and drop this post into the conversation."}
            </p>
            <small>{shareDraft.url}</small>
          </div>
          {shareDraft.previewImage ? (
            <div className="quick-share-banner__media">
              <img src={shareDraft.previewImage} alt="Shared post preview" />
            </div>
          ) : null}
          <div className="quick-share-banner__actions">
            <button
              type="button"
              className="friends-page-btn ghost"
              onClick={() => navigate(`/posts/${shareDraft.postId}/share`)}
            >
              Back to share
            </button>
          </div>
        </section>
      ) : null}

      <SectionCard
        title="Your groups"
        action={<button type="button">Create group</button>}
      >
        <div className="quick-list-grid two-col">
          {groups.map((group) => (
            <article key={group.id} className="quick-list-item quick-list-item--shareable">
              <strong>{group.name}</strong>
              <span>
                {shareDraft && groupShares?.[group.id]?.postId === shareDraft.postId
                  ? "Shared from this post"
                  : group.note}
              </span>
              <button
                type="button"
                className={shareDraft ? "quick-share-action" : ""}
                onClick={() => {
                  if (shareDraft) {
                    void handleGroupShare(group);
                    return;
                  }
                  toast.success(`${group.name} is ready to open soon.`);
                }}
              >
                {shareDraft ? "Share here" : "Open group"}
              </button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Suggested groups">
        <div className="quick-list-grid two-col">
          {["Stage Design Forum", "Music Business Circle", "Voice Coaches"].map((group) => (
            <article key={group} className="quick-list-item">
              <strong>{group}</strong>
              <span>Suggested for you</span>
              <button type="button">Join</button>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function EventsPage({ user }) {
  const events = [
    { when: "Mar 04", title: "Open Mic Night", place: "Lagos Studio Hub" },
    { when: "Mar 09", title: "Producer Masterclass", place: "Virtual" },
    { when: "Mar 14", title: "Creator Meet & Greet", place: "Abuja Creative Space" },
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Events"
      subtitle="Plan, create, and track upcoming activities."
    >
      <SectionCard
        title="Upcoming events"
        action={<button type="button">Create event</button>}
      >
        <ul className="quick-events-list">
          {events.map((event) => (
            <li key={event.title}>
              <strong>{event.when}</strong>
              <div>
                <b>{event.title}</b>
                <span>{event.place}</span>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function BirthdaysPage({ user }) {
  const navigate = useNavigate();
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sendingKey, setSendingKey] = useState("");
  const [wishDrafts, setWishDrafts] = useState({});

  const loadBirthdays = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const payload = await getFriendsHub();
      setBirthdays(Array.isArray(payload?.birthdays) ? payload.birthdays : []);
    } catch (err) {
      setBirthdays([]);
      setError(err?.message || "Failed to load birthdays");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBirthdays();
  }, [loadBirthdays]);

  const filteredBirthdays = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return birthdays;
    }

    return birthdays.filter((entry) => {
      const haystack = `${entry?.name || ""} ${entry?.username || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [birthdays, search]);

  const todaysBirthdays = useMemo(
    () => filteredBirthdays.filter((entry) => Boolean(entry?.birthdayIsToday)),
    [filteredBirthdays]
  );

  const upcomingBirthdays = useMemo(
    () => filteredBirthdays.filter((entry) => !entry?.birthdayIsToday),
    [filteredBirthdays]
  );

  const updateDraft = useCallback((personId, value) => {
    setWishDrafts((prev) => ({
      ...prev,
      [personId]: value,
    }));
  }, []);

  const fillWish = useCallback(
    (person, template) => {
      const personId = String(person?._id || "").trim();
      if (!personId) {
        return;
      }

      updateDraft(personId, template);
    },
    [updateDraft]
  );

  const sendWish = useCallback(
    async (person, override = "") => {
      const personId = String(person?._id || "").trim();
      const firstName = String(person?.name || "friend").trim().split(/\s+/)[0] || "friend";
      const message = String(
        override || wishDrafts[personId] || `Happy birthday, ${firstName}! Wishing you a beautiful day.`
      ).trim();

      if (!personId || !message) {
        return;
      }

      try {
        setSendingKey(personId);
        await sendChatMessage(personId, { text: message });
        setWishDrafts((prev) => ({
          ...prev,
          [personId]: "",
        }));
        toast.success(`Birthday wish sent to ${person?.name || "your friend"}.`);
      } catch (err) {
        toast.error(err?.message || "Failed to send birthday wish");
      } finally {
        setSendingKey("");
      }
    },
    [wishDrafts]
  );

  return (
    <QuickAccessLayout
      user={user}
      title="Birthdays"
      subtitle="Send wishes and keep up with your friends' celebrations."
    >
      <SectionCard
        title="Birthday calendar"
        action={
          <button
            type="button"
            className="friends-page-btn ghost"
            onClick={() => {
              void loadBirthdays({ silent: true });
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <div className="quick-stats-grid">
          <article className="quick-stat-card">
            <span>Today</span>
            <strong>{todaysBirthdays.length}</strong>
            <small>Ready to celebrate</small>
          </article>
          <article className="quick-stat-card">
            <span>Upcoming</span>
            <strong>{upcomingBirthdays.length}</strong>
            <small>Across your friends list</small>
          </article>
          <article className="quick-stat-card">
            <span>Total visible</span>
            <strong>{filteredBirthdays.length}</strong>
            <small>Shared by friends</small>
          </article>
        </div>
        <input
          className="quick-inline-input"
          placeholder="Search birthday list"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error ? <p className="quick-empty">{error}</p> : null}
      </SectionCard>

      <SectionCard title="Today's birthdays">
        {loading ? (
          <p className="quick-empty">Loading birthday celebrations...</p>
        ) : todaysBirthdays.length > 0 ? (
          <div className="birthday-card-grid">
            {todaysBirthdays.map((person) => {
              const personId = String(person?._id || "");
              const draft = wishDrafts[personId] || "";
              const isSending = sendingKey === personId;

              return (
                <article key={personId || person?.username} className="birthday-spotlight-card">
                  <button
                    type="button"
                    className="birthday-spotlight-card__profile"
                    onClick={() => navigate(`/profile/${person?.username || ""}`)}
                  >
                    <img
                      src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
                      alt={person?.name || "User"}
                    />
                    <div>
                      <strong>{person?.name || "Unknown user"}</strong>
                      <span>@{person?.username || "unknown"}</span>
                      <small>Celebrate them today</small>
                    </div>
                  </button>

                  <div className="birthday-spotlight-card__meta">
                    <span className="birthday-pill accent">{person?.birthdayLabel || "Today"}</span>
                    {person?.isCloseFriend ? (
                      <span className="birthday-pill">Close friend</span>
                    ) : null}
                  </div>

                  <div className="birthday-wish-presets">
                    {BIRTHDAY_WISH_PRESETS.map((template) => (
                      <button
                        key={`${personId}-${template}`}
                        type="button"
                        onClick={() => fillWish(person, template)}
                      >
                        {template}
                      </button>
                    ))}
                  </div>

                  <div className="birthday-wish-composer">
                    <input
                      value={draft}
                      onChange={(event) => updateDraft(personId, event.target.value)}
                      placeholder={`Write a birthday wish for ${person?.name || "your friend"}`}
                    />
                    <button
                      type="button"
                      className="friends-page-btn primary"
                      onClick={() => {
                        void sendWish(person);
                      }}
                      disabled={isSending}
                    >
                      {isSending ? "Sending..." : "Celebrate"}
                    </button>
                  </div>

                  <div className="birthday-spotlight-card__actions">
                    <button
                      type="button"
                      className="friends-page-btn ghost"
                      onClick={() => navigate(`/profile/${person?.username || ""}`)}
                    >
                      View profile
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="quick-empty">No friends are celebrating today yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Upcoming birthdays">
        {loading ? (
          <p className="quick-empty">Loading upcoming birthdays...</p>
        ) : upcomingBirthdays.length > 0 ? (
          <div className="birthday-upcoming-list">
            {upcomingBirthdays.map((person) => (
              <article key={person?._id || person?.username} className="birthday-upcoming-item">
                <button
                  type="button"
                  className="birthday-upcoming-item__profile"
                  onClick={() => navigate(`/profile/${person?.username || ""}`)}
                >
                  <img
                    src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
                    alt={person?.name || "User"}
                  />
                  <div>
                    <strong>{person?.name || "Unknown user"}</strong>
                    <span>@{person?.username || "unknown"}</span>
                  </div>
                </button>

                <div className="birthday-upcoming-item__copy">
                  <b>{person?.birthdayLabel || "Upcoming"}</b>
                  <small>
                    {person?.birthdayDaysUntil === 1
                      ? "Coming up tomorrow"
                      : `Coming up in ${person?.birthdayDaysUntil || 0} days`}
                  </small>
                </div>

                <div className="birthday-upcoming-item__actions">
                  {person?.isCloseFriend ? <span className="birthday-pill">Close friend</span> : null}
                  <button
                    type="button"
                    className="friends-page-btn ghost"
                    onClick={() => navigate(`/profile/${person?.username || ""}`)}
                  >
                    Open profile
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="quick-empty">No upcoming birthdays are visible right now.</p>
        )}
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function AdsManagerPage({ user }) {
  return (
    <QuickAccessLayout
      user={user}
      title="Ads Manager"
      subtitle="Launch and monitor campaigns from one dashboard."
    >
      <SectionCard title="Campaign controls">
        <div className="quick-stats-grid">
          <article className="quick-stat-card">
            <span>Active campaigns</span>
            <strong>3</strong>
            <small>Running now</small>
          </article>
          <article className="quick-stat-card">
            <span>Spend this month</span>
            <strong>$214</strong>
            <small>Budget on track</small>
          </article>
          <article className="quick-stat-card">
            <span>Results</span>
            <strong>18.4k</strong>
            <small>Reach</small>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Tools">
        <div className="quick-list-grid two-col">
          <article className="quick-list-item">
            <strong>Create ad</strong>
            <span>Build a new campaign flow</span>
            <button type="button">Start</button>
          </article>
          <article className="quick-list-item">
            <strong>Audience insights</strong>
            <span>Coming soon</span>
            <button type="button">Coming soon</button>
          </article>
          <article className="quick-list-item">
            <strong>A/B testing</strong>
            <span>Coming soon</span>
            <button type="button">Coming soon</button>
          </article>
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}
