import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";

import { apiRequest, resolveImage } from "../../api";
import QuickAccessLayout from "../../components/QuickAccessLayout";
import {
  readStoredGroupShares,
  writeStoredGroupShares,
} from "../../components/share/postShareUtils";
import {
  createGroup as createGroupRequest,
  createGroupPost as createGroupPostRequest,
  getMyGroups,
} from "./groupApi";
import {
  GROUPS_CHANGED_EVENT,
  addStoredGroupPost,
  createStoredGroup,
  purgeLegacyGroupArtifacts,
  readStoredGroups,
  replaceStoredGroups,
} from "./groupStore";
import "./groups.css";

const NAV_ITEMS = [
  { id: "feed", label: "Your feed", icon: "feed" },
  { id: "discover", label: "Discover", icon: "discover" },
  { id: "yours", label: "Your groups", icon: "groups" },
];

const GROUP_TABS = ["About", "Discussion", "Featured", "People", "Events", "Media"];

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Group"
  )}&size=160&background=DDEBE2&color=14532D`;

const getInitials = (name = "") =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";

const normalizeShareDraft = (value = {}) => {
  const postId = String(value?.postId || "").trim();
  const url = String(value?.url || "").trim();
  if (!postId || !url) {
    return null;
  }
  return {
    postId,
    url,
    note: String(value?.note || value?.excerpt || "").trim(),
    authorName: String(value?.authorName || "Tengacion creator").trim(),
  };
};

function GroupIcon({ name }) {
  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.7 4a6.7 6.7 0 1 0 4.16 11.95l4.1 4.1 1.42-1.42-4.1-4.1A6.7 6.7 0 0 0 10.7 4zm0 2a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4z" />
      </svg>
    );
  }
  if (name === "feed") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm1 4v2h9V8H5zm0 5v2h14v-2H5z" /></svg>;
  }
  if (name === "discover") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.7 6.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1zm-4 4 1.6-.6-.6 1.6-1.6.6.6-1.6z" /></svg>;
  }
  if (name === "groups") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1.5 20c.3-4.3 2.4-6.5 6.5-6.5s6.2 2.2 6.5 6.5h-13zm13.2-7.4c.4-.1.8-.1 1.3-.1 3.8 0 5.8 2 6.1 6h-5.8a9.6 9.6 0 0 0-1.6-5.9z" /></svg>;
  }
  if (name === "settings") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.4 1.2 1-.2 1.2-1.5.5-.8 1.4.3 1.6-1 .8-1.5-.7-1.6.6-.7 1.4-1.2.1-.9-1.3H11l-1 1.2-1.2-.3-.4-1.5-1.4-.9-1.6.2-.7-1.1.8-1.4-.5-1.6-1.4-.8v-1.2l1.4-.8.5-1.6-.8-1.4.7-1.1 1.6.2 1.4-.9.4-1.5 1.2-.3 1 1.2h1.6l.9-1.3 1.2.1.7 1.4 1.6.6 1.5-.7 1 .8-.3 1.6.8 1.4 1.5.5.2 1.2-1.2 1zM12.5 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" /></svg>;
  }
  return null;
}

function EmptyGroups({ mode, onCreate }) {
  const copy =
    mode === "discover"
      ? {
          title: "Discover groups made by the community",
          body: "Public groups created by Tengacion users will appear here when community discovery is available.",
        }
      : mode === "yours"
        ? {
            title: "You haven't created any groups yet",
            body: "Build a space for the people, conversations, and interests that matter to you.",
          }
        : {
            title: "Your group feed is ready for you",
            body: "Create your first group to start conversations and see group posts here.",
          };

  return (
    <section className="groups-empty card">
      <div className="groups-empty__art" aria-hidden="true">
        <span>+</span>
        <GroupIcon name="groups" />
      </div>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <button type="button" className="groups-primary-button" onClick={onCreate}>
        + Create New Group
      </button>
    </section>
  );
}

function CreateGroupModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setPrivacy("public");
      setDescription("");
      setCoverImage("");
      return undefined;
    }
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="groups-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="groups-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="groups-create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="groups-create-title">Create group</h2>
            <p>Bring people together around a shared interest.</p>
          </div>
          <button type="button" className="groups-icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              toast.error("Give your group a name");
              return;
            }
            onCreate({ name, privacy, description, coverImage });
          }}
        >
          <label>
            Group name
            <input
              autoFocus
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name your group"
            />
          </label>
          <label>
            Choose privacy
            <select value={privacy} onChange={(event) => setPrivacy(event.target.value)}>
              <option value="public">Public — anyone can find and view the group</option>
              <option value="private">Private — only members can view posts</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              rows={4}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group about?"
            />
          </label>
          <label>
            Cover image URL <span>(optional)</span>
            <input
              type="url"
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="https://example.com/cover.jpg"
            />
          </label>
          <footer>
            <button type="button" className="groups-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="groups-primary-button">Create group</button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

function GroupAvatar({ member, name }) {
  return (
    <img
      src={resolveImage(member?.avatar) || fallbackAvatar(member?.name || name)}
      alt={member?.name || "Group member"}
    />
  );
}

function GroupDirectoryCard({ group, shareDraft, shared, onOpen, onShare }) {
  return (
    <article className="groups-directory-card card">
      <button type="button" className="groups-directory-card__cover" onClick={onOpen}>
        {group.coverImage ? <img src={resolveImage(group.coverImage)} alt="" /> : <span>{getInitials(group.name)}</span>}
      </button>
      <div className="groups-directory-card__body">
        <button type="button" className="groups-directory-card__title" onClick={onOpen}>{group.name}</button>
        <span>{group.privacy === "private" ? "Private" : "Public"} group · {group.members.length} member{group.members.length === 1 ? "" : "s"}</span>
        <p>{group.description || "A new Tengacion community."}</p>
        <button
          type="button"
          className={shareDraft ? "groups-primary-button" : "groups-secondary-button"}
          onClick={shareDraft ? onShare : onOpen}
        >
          {shareDraft ? (shared ? "Shared here" : "Share here") : "View group"}
        </button>
      </div>
    </article>
  );
}

function GroupPost({ post }) {
  const date = post.createdAt ? new Date(post.createdAt) : null;
  return (
    <article className="groups-post card">
      <header>
        <GroupAvatar member={post.author} />
        <div>
          <strong>{post.author?.name || "Tengacion member"}</strong>
          <span>{date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : "Just now"}</span>
        </div>
        <button type="button" className="groups-icon-button" aria-label="Post options">•••</button>
      </header>
      <p>{post.text}</p>
      <footer>
        <button type="button">Like</button>
        <button type="button">Comment</button>
        <button type="button">Share</button>
      </footer>
    </article>
  );
}

function GroupDetail({ group, user, shareDraft, shared, onShare, onRefresh }) {
  const [activeTab, setActiveTab] = useState("Discussion");
  const [postText, setPostText] = useState("");
  const owner = group.members[0];

  const publishPost = async () => {
    if (!postText.trim()) {
      return;
    }
    try {
      const updatedGroup = await createGroupPostRequest(group.id, postText);
      replaceStoredGroups(
        readStoredGroups(user).map((entry) => (entry.id === updatedGroup.id ? updatedGroup : entry)),
        user
      );
    } catch {
      addStoredGroupPost(group.id, postText, user);
    }
    setPostText("");
    await onRefresh();
    toast.success("Posted to your group");
  };

  return (
    <div className="groups-detail">
      <section className="groups-profile card">
        <div className="groups-profile__cover">
          {group.coverImage ? <img src={resolveImage(group.coverImage)} alt={`${group.name} cover`} /> : <span>{getInitials(group.name)}</span>}
        </div>
        <div className="groups-profile__identity">
          <div>
            <h1>{group.name}</h1>
            <p>{group.privacy === "private" ? "🔒 Private group" : "🌐 Public group"} · {group.members.length} member{group.members.length === 1 ? "" : "s"}</p>
            <div className="groups-member-stack">
              {group.members.slice(0, 10).map((member) => <GroupAvatar key={member.id || member.name} member={member} />)}
            </div>
          </div>
          <div className="groups-profile__actions">
            <button type="button" className="groups-primary-button" onClick={() => toast("Invites are coming next.")}>+ Invite</button>
            <button type="button" className="groups-secondary-button" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Group link copied"))}>Share</button>
            <button type="button" className="groups-secondary-button">✓ Joined</button>
            {shareDraft ? <button type="button" className="groups-primary-button" onClick={onShare}>{shared ? "Shared here" : "Share post here"}</button> : null}
          </div>
        </div>
        <nav className="groups-profile__tabs" aria-label="Group sections">
          {GROUP_TABS.map((tab) => (
            <button key={tab} type="button" className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
          <span className="groups-profile__tab-actions">
            <button type="button" className="groups-icon-button" aria-label="Search group"><GroupIcon name="search" /></button>
            <button type="button" className="groups-icon-button" aria-label="Group options">•••</button>
          </span>
        </nav>
      </section>

      {activeTab === "Discussion" ? (
        <div className="groups-detail__columns">
          <div className="groups-discussion">
            <section className="groups-composer card">
              <GroupAvatar member={{ name: user?.name || user?.username, avatar: user?.avatar }} />
              <button type="button" onClick={() => document.getElementById(`group-post-${group.id}`)?.focus()}>Write something...</button>
              <textarea id={`group-post-${group.id}`} value={postText} onChange={(event) => setPostText(event.target.value)} placeholder={`Post in ${group.name}`} rows={postText ? 3 : 1} />
              <div className="groups-composer__actions">
                <span>Photo/video</span><span>Feeling/activity</span><span>Check in</span>
                <button type="button" className="groups-primary-button" disabled={!postText.trim()} onClick={() => void publishPost()}>Post</button>
              </div>
            </section>
            <section className="groups-featured card"><strong>Featured</strong><span>No featured posts yet</span><b>⌄</b></section>
            <div className="groups-sort-row"><strong>Most relevant</strong><span>⌄</span></div>
            {group.posts.length ? group.posts.map((post) => <GroupPost key={post.id} post={post} />) : (
              <section className="groups-no-posts card"><h3>Start the conversation</h3><p>Be the first person to post in this group.</p></section>
            )}
          </div>
          <aside className="groups-about-column">
            <section className="groups-about-card card">
              <h2>About</h2>
              <p>{group.description || "No group description has been added yet."}</p>
              <div><b>{group.privacy === "private" ? "🔒 Private" : "🌐 Public"}</b><span>{group.privacy === "private" ? "Only members can see who's in the group and what they post." : "Anyone can see who's in the group and what they post."}</span></div>
              <div><b>◉ Visible</b><span>Anyone can find this group.</span></div>
            </section>
            <section className="groups-about-card card"><h2>Admin</h2><div className="groups-admin-row"><GroupAvatar member={owner} /><span><b>{owner?.name || "Group admin"}</b><small>Group creator</small></span></div></section>
          </aside>
        </div>
      ) : activeTab === "About" ? (
        <section className="groups-tab-panel card"><h2>About this group</h2><p>{group.description || "No description yet."}</p><b>{group.privacy === "private" ? "Private group" : "Public group"}</b></section>
      ) : activeTab === "People" ? (
        <section className="groups-tab-panel card"><h2>People · {group.members.length}</h2>{group.members.map((member) => <div key={member.id || member.name} className="groups-people-row"><GroupAvatar member={member} /><span><b>{member.name}</b><small>{member.role}</small></span></div>)}</section>
      ) : (
        <section className="groups-tab-panel card"><h2>{activeTab}</h2><p>Nothing has been added here yet.</p></section>
      )}
    </div>
  );
}

export default function GroupsWorkspacePage({ user }) {
  const location = useLocation();
  const shareDraft = normalizeShareDraft(location.state?.sharePost);
  const [groups, setGroups] = useState(() => readStoredGroups(user));
  const [activeView, setActiveView] = useState("feed");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [groupShares, setGroupShares] = useState(() => readStoredGroupShares());

  const refreshGroups = useCallback(async () => {
    try {
      const serverGroups = await getMyGroups();
      const nextGroups = replaceStoredGroups(Array.isArray(serverGroups) ? serverGroups : [], user);
      setGroups(nextGroups);
      return nextGroups;
    } catch {
      const cachedGroups = readStoredGroups(user);
      setGroups(cachedGroups);
      return cachedGroups;
    }
  }, [user]);

  useEffect(() => {
    purgeLegacyGroupArtifacts();
    void refreshGroups();
    const refresh = () => void refreshGroups();
    window.addEventListener(GROUPS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GROUPS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refreshGroups]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return groups;
    }
    return groups.filter((group) => `${group.name} ${group.description}`.toLowerCase().includes(needle));
  }, [groups, search]);

  const openGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setActiveView("yours");
  };

  const handleShare = async (group) => {
    if (!shareDraft || groupShares?.[group.id]?.postId === shareDraft.postId) {
      return;
    }
    await apiRequest(`/api/posts/${encodeURIComponent(shareDraft.postId)}/share`, { method: "POST" }).catch(() => null);
    const nextShares = {
      ...groupShares,
      [group.id]: { postId: shareDraft.postId, groupName: group.name, sharedAt: new Date().toISOString() },
    };
    setGroupShares(nextShares);
    writeStoredGroupShares(nextShares);
    toast.success(`Shared to ${group.name}`);
  };

  return (
    <QuickAccessLayout
      user={user}
      showAppSidebar={false}
      showRightRail={false}
      showHero={false}
      shellClassName="groups-shell"
      mainClassName="groups-main"
    >
      <div className="groups-workspace">
        <aside className="groups-sidebar">
          <header>
            <h1>Groups</h1>
            <button type="button" className="groups-icon-button" aria-label="Group settings"><GroupIcon name="settings" /></button>
          </header>
          <label className="groups-search">
            <GroupIcon name="search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups" />
          </label>
          <nav>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={!selectedGroup && activeView === item.id ? "active" : ""}
                onClick={() => { setSelectedGroupId(""); setActiveView(item.id); }}
              >
                <span><GroupIcon name={item.icon} /></span>{item.label}
              </button>
            ))}
          </nav>
          <button type="button" className="groups-create-button" onClick={() => setCreateOpen(true)}>+ Create New Group</button>
          <div className="groups-sidebar__divider" />
          <section className="groups-sidebar__owned">
            <h2>Groups you manage</h2>
            {filteredGroups.length ? filteredGroups.map((group) => (
              <button key={group.id} type="button" className={selectedGroupId === group.id ? "active" : ""} onClick={() => openGroup(group.id)}>
                <span className="groups-sidebar__thumb">{group.coverImage ? <img src={resolveImage(group.coverImage)} alt="" /> : getInitials(group.name)}</span>
                <span><b>{group.name}</b><small>{group.posts.length ? `${group.posts.length} post${group.posts.length === 1 ? "" : "s"}` : "New group"}</small></span>
              </button>
            )) : <p>No groups yet.</p>}
          </section>
        </aside>

        <main className="groups-content">
          {shareDraft ? <section className="groups-share-notice"><div><b>Share a post to a group</b><span>{shareDraft.authorName}: {shareDraft.note || shareDraft.url}</span></div><small>Choose one of your groups</small></section> : null}
          {selectedGroup ? (
            <GroupDetail
              group={selectedGroup}
              user={user}
              shareDraft={shareDraft}
              shared={groupShares?.[selectedGroup.id]?.postId === shareDraft?.postId}
              onShare={() => void handleShare(selectedGroup)}
              onRefresh={refreshGroups}
            />
          ) : groups.length === 0 ? (
            <EmptyGroups mode={activeView} onCreate={() => setCreateOpen(true)} />
          ) : activeView === "discover" ? (
            <EmptyGroups mode="discover" onCreate={() => setCreateOpen(true)} />
          ) : (
            <section className="groups-directory">
              <header><div><h1>{activeView === "yours" ? "Your groups" : "Recent activity"}</h1><p>{activeView === "yours" ? "Groups you manage and belong to" : "Catch up with your communities"}</p></div></header>
              <div className="groups-directory__grid">
                {filteredGroups.map((group) => (
                  <GroupDirectoryCard
                    key={group.id}
                    group={group}
                    shareDraft={shareDraft}
                    shared={groupShares?.[group.id]?.postId === shareDraft?.postId}
                    onOpen={() => openGroup(group.id)}
                    onShare={() => void handleShare(group)}
                  />
                ))}
              </div>
              {!filteredGroups.length ? <p className="groups-search-empty">No groups match “{search}”.</p> : null}
            </section>
          )}
        </main>
      </div>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(draft) => {
          void (async () => {
            let group;
            try {
              group = await createGroupRequest(draft);
              replaceStoredGroups([...readStoredGroups(user), group], user);
            } catch {
              group = createStoredGroup(draft, user);
              toast("The group was saved on this device and will sync when the server is available.");
            }
            await refreshGroups();
            setCreateOpen(false);
            openGroup(group.id);
            toast.success(`${group.name} was created`);
          })();
        }}
      />
    </QuickAccessLayout>
  );
}
