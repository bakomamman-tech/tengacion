import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import QuickAccessLayout from "../../components/QuickAccessLayout";
import BirthdayWorkspacePage from "../../features/birthdays/BirthdayWorkspacePage";
import GroupsWorkspacePage from "../../features/groups/GroupsWorkspacePage";

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
              <button type="button" disabled title="This legacy sample does not open Messenger">Message unavailable</button>
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
              <button type="button" disabled title="This legacy sample cannot create a friend request">Add friend unavailable</button>
            </article>
          ))}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}

export function ProfessionalDashboardPage({ user }) {
  return (
    <PreviewFeaturePage
      user={user}
      title="Professional Dashboard"
      explanation="The general professional analytics dashboard does not yet have an approved production data source. No audience, engagement, or message totals are shown here until they can be verified."
      alternativePath="/creator/dashboard"
      alternativeLabel="Open the creator workspace"
    />
  );
}

export function MemoriesPage({ user }) {
  return (
    <PreviewFeaturePage
      user={user}
      title="Memories"
      explanation="Tengacion does not yet have a production history service for generating or sharing memories. This page does not infer personal milestones from sample data."
      alternativePath="/activity"
      alternativeLabel="View public activity"
    />
  );
}

export function SavedPage({ user }) {
  return (
    <PreviewFeaturePage
      user={user}
      title="Saved"
      explanation="A unified Saved collection is not production-ready. News saves and purchased creator content currently remain separate, authoritative systems."
      alternativePath="/purchases"
      alternativeLabel="Open purchased content"
    />
  );
}

export function GroupsPage({ user }) {
  return <GroupsWorkspacePage user={user} />;
}

function PreviewFeaturePage({
  user,
  title,
  explanation,
  alternativePath,
  alternativeLabel,
}) {
  return (
    <QuickAccessLayout
      user={user}
      title={title}
      subtitle="This surface is being prepared for a future Tengacion release."
    >
      <section className="card quick-preview-state" aria-labelledby="quick-preview-title">
        <span className="feature-lifecycle-badge">Preview</span>
        <h2 id="quick-preview-title">{title} is not available yet</h2>
        <p>{explanation}</p>
        <p>
          Tengacion will only publish this feature after its data, permissions, and
          user workflows are production-ready.
        </p>
        {alternativePath && alternativeLabel ? (
          <Link className="quick-preview-link" to={alternativePath}>
            {alternativeLabel}
          </Link>
        ) : null}
      </section>
    </QuickAccessLayout>
  );
}

export function EventsPage({ user }) {
  return (
    <PreviewFeaturePage
      user={user}
      title="Events"
      explanation="General event creation and attendance are not backed by a production Event domain yet. Dates, venues, and registrations will appear only when they are server-verified."
      alternativePath="/groups"
      alternativeLabel="Explore Groups (Beta)"
    />
  );
}

export function BirthdaysPage({ user }) {
  return <BirthdayWorkspacePage user={user} />;
}

export function AdsManagerPage({ user }) {
  return (
    <PreviewFeaturePage
      user={user}
      title="Ads Manager"
      explanation="Advertising is not available because campaign delivery, billing, audience controls, and reporting are not implemented as a production system. No campaign or spend figures are presented here."
      alternativePath="/creator/dashboard"
      alternativeLabel="Open the creator workspace"
    />
  );
}
