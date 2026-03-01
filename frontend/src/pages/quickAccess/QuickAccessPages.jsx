import { useMemo, useState } from "react";

import QuickAccessLayout from "../../components/QuickAccessLayout";

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

  const friends = [
    "Damilola Grant",
    "Seyi Okon",
    "Miriam Akin",
    "Lilian Ugo",
    "Timi Gold",
    "Ada Nkem",
  ];
  const suggestions = [
    "Jesse Manu",
    "Bola Tamuno",
    "Nelly Jude",
    "Arielle Dan",
    "Mark Dike",
    "King Lu",
  ];

  const filteredFriends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return friends;
    }
    return friends.filter((name) => name.toLowerCase().includes(needle));
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
          {suggestions.map((name) => (
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
  const groups = [
    "Tengacion Artists Hub",
    "Afrobeat Producers",
    "Live Session Organizers",
    "Songwriters Community",
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Groups"
      subtitle="Discover and manage your creative communities."
    >
      <SectionCard
        title="Your groups"
        action={<button type="button">Create group</button>}
      >
        <div className="quick-list-grid two-col">
          {groups.map((group) => (
            <article key={group} className="quick-list-item">
              <strong>{group}</strong>
              <span>Active this week</span>
              <button type="button">Open group</button>
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
  const birthdays = [
    { name: "Grace Obi", when: "Today" },
    { name: "Daniel Musa", when: "Tomorrow" },
    { name: "Halima Yusuf", when: "Mar 5" },
  ];

  return (
    <QuickAccessLayout
      user={user}
      title="Birthdays"
      subtitle="Send wishes and keep up with your friends' celebrations."
    >
      <SectionCard title="Birthday reminders">
        <div className="quick-list-grid">
          {birthdays.map((entry) => (
            <article key={entry.name} className="quick-list-item">
              <strong>{entry.name}</strong>
              <span>{entry.when}</span>
              <button type="button">Send wish</button>
            </article>
          ))}
        </div>
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
