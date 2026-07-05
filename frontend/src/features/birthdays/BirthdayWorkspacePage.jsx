import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getFriendsHub, resolveImage, sendChatMessage } from "../../api";
import QuickAccessLayout from "../../components/QuickAccessLayout";
import "./birthdays.css";

const WISH_PRESETS = [
  "HBD! 🎉🎁",
  "Enjoy your birthday! 🎁☕💐",
  "Happy Birthday! Wishing you a wonderful day! 🎈🥂",
];

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Friend"
  )}&size=160&background=E3EFE7&color=1B5838`;

const formatBirthdayDate = (person) => {
  const day = Number(person?.birthday?.day) || 0;
  const month = Number(person?.birthday?.month) || 0;
  const year = Number(person?.birthday?.year) || 0;
  if (!day || !month) {
    return "Birthday";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
  }).format(new Date(year || 2000, month - 1, day));
};

function BirthdayIcon({ name }) {
  if (name === "search") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 0 4.05 11.58l4.35 4.35 1.42-1.42-4.35-4.35A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" /></svg>;
  }
  if (name === "calendar") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h2v3h8V2h2v3h2a2 2 0 0 1 2 2v13H2V7a2 2 0 0 1 2-2h2V2zm14 8H4v8h16v-8zM4 7v1h16V7H4z" /></svg>;
  }
  if (name === "person") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8.5 9c.3-4.8 3.1-7.2 8.5-7.2s8.2 2.4 8.5 7.2h-17z" /></svg>;
  }
  if (name === "bell") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3.2c0 1.2-.4 2.4-1.1 3.3L4.5 15a1.3 1.3 0 0 0 1 2.1h13a1.3 1.3 0 0 0 1-2.1l-1.4-1.5a5.4 5.4 0 0 1-1.1-3.3V7a5 5 0 0 0-5-5zm-2.7 17a2.8 2.8 0 0 0 5.4 0H9.3z" /></svg>;
  }
  if (name === "cake") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c1.1 0 2-.9 2-2s-2-3-2-3-2 1.9-2 3 .9 2 2 2zM7 8h10l1.3 3H5.7L7 8zm-2 4h14v9H5v-9zm2 2v2c1 .8 2 .8 3 0 1 .8 2 .8 3 0 1 .8 2 .8 3 0 1 .8 1 .8 1 .8V14H7z" /></svg>;
  }
  if (name === "send") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2.8 3.5 18.7 8.1c.7.3.7 1.3 0 1.6L2.8 21.3c-.6.3-1.3-.3-1.1-1l2.1-6.5 9.2-1.4-9.2-1.5-2.1-6.4c-.2-.7.5-1.3 1.1-1z" /></svg>;
  }
  return null;
}

function BirthdaySidebar({ search, onSearch }) {
  const navigate = useNavigate();
  const items = [
    { label: "Home", icon: "calendar", path: "/events" },
    { label: "Your events", icon: "person", path: "/events" },
    { label: "Notifications", icon: "bell", path: "/notifications" },
  ];

  return (
    <aside className="birthdays-sidebar">
      <h1>Events</h1>
      <label className="birthdays-sidebar__search">
        <BirthdayIcon name="search" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search birthdays" />
      </label>
      <nav>
        {items.map((item) => (
          <button key={item.label} type="button" onClick={() => navigate(item.path)}>
            <span><BirthdayIcon name={item.icon} /></span>{item.label}
          </button>
        ))}
      </nav>
      <button type="button" className="birthdays-create-event" onClick={() => navigate("/events")}>+ Create new event</button>
      <div className="birthdays-sidebar__divider" />
      <section>
        <h2>Birthdays</h2>
        <button type="button" className="active"><span><BirthdayIcon name="cake" /></span>Birthday calendar</button>
        <p>Birthday reminders are based on the dates your friends choose to share.</p>
      </section>
    </aside>
  );
}

function WishComposer({ person, value, sending, onChange, onPreset, onSend }) {
  return (
    <div className="birthday-fb-composer">
      <div className="birthday-fb-composer__input">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={`Happy Birthday, ${String(person?.name || "friend").split(/\s+/)[0]}! 🎉🎁`}
        />
        <span aria-hidden="true">☺</span>
      </div>
      <button type="button" className="birthday-send-button" onClick={onSend} disabled={sending} aria-label="Send birthday wish">
        {sending ? "…" : <BirthdayIcon name="send" />}
      </button>
      <div className="birthday-fb-presets">
        {WISH_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => onPreset(preset)}>{preset}</button>)}
      </div>
    </div>
  );
}

function BirthdayPerson({ person, recent = false, draft, sending, onDraft, onPreset, onSend, onProfile }) {
  const age = Number(person?.birthdayAge) || 0;
  return (
    <article className={`birthday-fb-person${recent ? " recent" : ""}`} id={`birthday-${person?._id}`}>
      <button type="button" className="birthday-fb-person__avatar" onClick={onProfile}>
        <img src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)} alt={person?.name || "Friend"} />
      </button>
      <div className="birthday-fb-person__body">
        <div className="birthday-fb-person__heading">
          <button type="button" onClick={onProfile}>{person?.name || "Tengacion friend"}</button>
          {recent ? <span>{formatBirthdayDate(person)}</span> : null}
          {age ? <small>{age} years old</small> : null}
        </div>
        <WishComposer
          person={person}
          value={draft}
          sending={sending}
          onChange={onDraft}
          onPreset={onPreset}
          onSend={onSend}
        />
      </div>
    </article>
  );
}

function BirthdaySection({ title, people, recent, loading, drafts, sendingKey, onDraft, onPreset, onSend, onProfile, emptyText }) {
  return (
    <section className="birthday-fb-section">
      <h2>{title}</h2>
      {loading ? <p className="birthday-fb-empty">Loading birthdays...</p> : people.length ? people.map((person) => {
        const id = String(person?._id || "");
        return (
          <BirthdayPerson
            key={id || person?.username}
            person={person}
            recent={recent}
            draft={drafts[id] || ""}
            sending={sendingKey === id}
            onDraft={(value) => onDraft(id, value)}
            onPreset={(value) => onPreset(id, value)}
            onSend={() => onSend(person)}
            onProfile={() => onProfile(person)}
          />
        );
      }) : <p className="birthday-fb-empty">{emptyText}</p>}
    </section>
  );
}

export default function BirthdayWorkspacePage({ user }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState({});
  const [sendingKey, setSendingKey] = useState("");

  const loadBirthdays = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await getFriendsHub();
      setBirthdays(Array.isArray(payload?.birthdays) ? payload.birthdays : []);
    } catch (err) {
      setError(err?.message || "Could not load birthdays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBirthdays();
  }, [loadBirthdays]);

  useEffect(() => {
    const focusId = params.get("focus");
    if (!loading && focusId) {
      window.setTimeout(() => document.getElementById(`birthday-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }, [loading, params]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? birthdays.filter((person) => `${person?.name || ""} ${person?.username || ""}`.toLowerCase().includes(needle)) : birthdays;
  }, [birthdays, search]);

  const today = visible.filter((person) => person?.birthdayIsToday);
  const recent = visible.filter((person) => !person?.birthdayIsToday && Number(person?.birthdayDaysAgo) > 0 && Number(person?.birthdayDaysAgo) <= 7);

  const sendWish = async (person) => {
    const id = String(person?._id || "");
    const firstName = String(person?.name || "friend").split(/\s+/)[0];
    const text = String(drafts[id] || `Happy Birthday, ${firstName}! 🎉🎁`).trim();
    if (!id || !text) {
      return;
    }
    try {
      setSendingKey(id);
      await sendChatMessage(id, { text });
      setDrafts((current) => ({ ...current, [id]: "" }));
      toast.success(`Birthday wish sent to ${person?.name || "your friend"}`);
    } catch (err) {
      toast.error(err?.message || "Failed to send birthday wish");
    } finally {
      setSendingKey("");
    }
  };

  return (
    <QuickAccessLayout user={user} showAppSidebar={false} showRightRail={false} showHero={false} shellClassName="birthdays-shell" mainClassName="birthdays-main">
      <div className="birthdays-workspace">
        <BirthdaySidebar search={search} onSearch={setSearch} />
        <main className="birthdays-content">
          {error ? <section className="birthday-fb-error"><span>{error}</span><button type="button" onClick={() => void loadBirthdays()}>Try again</button></section> : null}
          <BirthdaySection
            title="Today's birthdays"
            people={today}
            loading={loading}
            drafts={drafts}
            sendingKey={sendingKey}
            onDraft={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            onPreset={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            onSend={(person) => void sendWish(person)}
            onProfile={(person) => navigate(`/profile/${person?.username || ""}`)}
            emptyText="No friends are celebrating today."
          />
          <BirthdaySection
            title="Recent birthdays"
            people={recent}
            recent
            loading={loading}
            drafts={drafts}
            sendingKey={sendingKey}
            onDraft={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            onPreset={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            onSend={(person) => void sendWish(person)}
            onProfile={(person) => navigate(`/profile/${person?.username || ""}`)}
            emptyText="No birthdays in the past seven days."
          />
        </main>
      </div>
    </QuickAccessLayout>
  );
}
