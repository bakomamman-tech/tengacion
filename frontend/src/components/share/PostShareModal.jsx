import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import {
  apiRequest,
  createPost,
  createStory,
  getChatContacts,
  getFriendsHub,
  getPostById,
  sendChatMessage,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import QuickShareActions from "./QuickShareActions";
import ShareComposerHeader from "./ShareComposerHeader";
import SharePreviewCard from "./SharePreviewCard";
import SuggestedShareTargets from "./SuggestedShareTargets";
import {
  DEFAULT_SHARE_GROUPS,
  buildPostShareUrl,
  buildShareBody,
  buildShareState,
  mapPrivacyToStoryVisibility,
  mergeShareTargets,
  readStoredGroupShares,
  writeStoredGroupShares,
} from "./postShareUtils";

const ANIMATION_MS = 220;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const getPostId = (value) => String(value?._id || value?.postId || "").trim();

const emitShareEvent = (detail = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("tengacion:share-action", {
      detail,
    })
  );
};

function TargetCard({
  title,
  subtitle,
  active = false,
  badge = "",
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`tg-share-target-card${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {badge ? <small>{badge}</small> : null}
    </button>
  );
}

export default function PostShareModal({
  open = false,
  post: postProp = null,
  postId = "",
  initialPost = null,
  onClose,
  onShareCreated,
  onShareCountChange,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const captionRef = useRef(null);
  const messengerSearchRef = useRef(null);
  const groupSectionRef = useRef(null);
  const profileSectionRef = useRef(null);
  const previousFocusRef = useRef(null);
  const renderRef = useRef(false);

  const resolvedPostId = useMemo(
    () => getPostId(postProp) || getPostId(initialPost) || String(postId || "").trim(),
    [initialPost, postId, postProp]
  );
  const seededPost = useMemo(() => {
    if (getPostId(postProp) === resolvedPostId) {
      return postProp;
    }
    if (getPostId(initialPost) === resolvedPostId) {
      return initialPost;
    }
    return null;
  }, [initialPost, postProp, resolvedPostId]);

  const [shouldRender, setShouldRender] = useState(open);
  const [post, setPost] = useState(seededPost);
  const [loading, setLoading] = useState(open && !seededPost);
  const [error, setError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [destination, setDestination] = useState("feed");
  const [privacy, setPrivacy] = useState("public");
  const [caption, setCaption] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [messengerSearch, setMessengerSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [groupShares, setGroupShares] = useState({});

  const shareUrl = useMemo(() => buildPostShareUrl(resolvedPostId), [resolvedPostId]);
  const shareState = useMemo(
    () => buildShareState({ post, note: caption, url: shareUrl }),
    [caption, post, shareUrl]
  );
  const messengerTargets = useMemo(() => mergeShareTargets(contacts, friends), [contacts, friends]);
  const filteredMessengerTargets = useMemo(() => {
    const needle = String(messengerSearch || "").trim().toLowerCase();
    if (!needle) {
      return messengerTargets;
    }

    return messengerTargets.filter((entry) => {
      const haystack = `${entry?.name || ""} ${entry?.username || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [messengerSearch, messengerTargets]);
  const profileTargets = useMemo(() => {
    const source = mergeShareTargets([], friends);
    const needle = String(profileSearch || "").trim().toLowerCase();
    if (!needle) {
      return source;
    }

    return source.filter((entry) => {
      const haystack = `${entry?.name || ""} ${entry?.username || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [friends, profileSearch]);
  const selectedProfile = useMemo(
    () => profileTargets.find((entry) => entry._id === selectedProfileId) || null,
    [profileTargets, selectedProfileId]
  );
  const orderedGroups = useMemo(() => {
    const rows = [...DEFAULT_SHARE_GROUPS];
    return rows.sort((left, right) => {
      const rightTime = Date.parse(groupShares?.[right.id]?.sharedAt || "") || 0;
      const leftTime = Date.parse(groupShares?.[left.id]?.sharedAt || "") || 0;
      return rightTime - leftTime;
    });
  }, [groupShares]);
  const selectedGroup = useMemo(
    () => orderedGroups.find((entry) => entry.id === selectedGroupId) || null,
    [orderedGroups, selectedGroupId]
  );
  const destinationNeedsSelection =
    (destination === "group" && !selectedGroupId) ||
    (destination === "profile" && !selectedProfileId);
  const disablePrimary =
    !post ||
    Boolean(error) ||
    Boolean(loading) ||
    Boolean(busyAction) ||
    destinationNeedsSelection;
  const primaryLabel =
    destination === "story"
      ? "Share to story"
      : destination === "group"
        ? "Share to group"
        : destination === "profile"
          ? "Share to profile"
          : "Share now";
  const helperText =
    destination === "story"
      ? "Stories use story visibility rules. Selecting Only me will share to Friends instead."
      : destination === "group"
        ? "Choose a group below, then publish this share into that community."
        : destination === "profile"
          ? "Choose one friend below to continue the profile share flow."
          : "Your shared post will keep the original author and source metadata attached.";

  const resetState = useCallback(() => {
    setDestination("feed");
    setPrivacy("public");
    setCaption("");
    setBusyAction("");
    setInlineError("");
    setMessengerSearch("");
    setProfileSearch("");
    setSelectedGroupId("");
    setSelectedProfileId("");
  }, []);

  const requestClose = useCallback(() => {
    if (busyAction) {
      return;
    }
    onClose?.();
  }, [busyAction, onClose]);

  const recordShare = useCallback(async () => {
    if (!resolvedPostId) {
      return null;
    }

    const payload = await apiRequest(`/api/posts/${encodeURIComponent(resolvedPostId)}/share`, {
      method: "POST",
    });

    const nextCount = Number(payload?.shareCount);
    if (Number.isFinite(nextCount)) {
      onShareCountChange?.(nextCount);
      setPost((current) => (current ? { ...current, shareCount: nextCount } : current));
    }

    return payload;
  }, [onShareCountChange, resolvedPostId]);

  const finishSuccess = useCallback(
    (message, eventDetail = {}) => {
      toast.success(message);
      emitShareEvent({
        postId: resolvedPostId,
        destination,
        privacy,
        ...eventDetail,
      });
      resetState();
      onClose?.();
    },
    [destination, onClose, privacy, resetState, resolvedPostId]
  );

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      renderRef.current = true;
      return undefined;
    }

    if (!renderRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShouldRender(false);
      renderRef.current = false;
    }, ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPost(seededPost);
    setLoading(!seededPost);
    setError("");
    setInlineError("");
    setGroupShares(readStoredGroupShares());
    resetState();
  }, [open, resolvedPostId, resetState, seededPost]);

  useEffect(() => {
    if (!open || !resolvedPostId) {
      return;
    }

    let active = true;

    const loadPost = async () => {
      if (seededPost) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const payload = await getPostById(resolvedPostId);
        if (!active) {
          return;
        }
        setPost(payload);
      } catch (err) {
        if (active) {
          setError(err?.message || "Could not load this post.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPost();

    return () => {
      active = false;
    };
  }, [open, resolvedPostId, seededPost]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadTargets = async () => {
      try {
        setContactsLoading(true);
        const [contactRows, hub] = await Promise.all([
          getChatContacts().catch(() => []),
          getFriendsHub().catch(() => ({ friends: [] })),
        ]);
        if (!active) {
          return;
        }
        setContacts(Array.isArray(contactRows) ? contactRows : []);
        setFriends(Array.isArray(hub?.friends) ? hub.friends : []);
      } finally {
        if (active) {
          setContactsLoading(false);
        }
      }
    };

    void loadTargets();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender || !open) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    document.body.classList.add("tg-share-modal-open");

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 40);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const nodes = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true"
      );

      if (nodes.length === 0) {
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.classList.remove("tg-share-modal-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, requestClose, shouldRender]);

  const focusMessenger = useCallback(() => {
    messengerSearchRef.current?.focus();
    setInlineError("");
    toast.success("Choose a contact below to send it in Messenger.");
  }, []);

  const focusGroupFlow = useCallback(() => {
    setDestination("group");
    setInlineError("");
    window.setTimeout(() => {
      groupSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, []);

  const focusProfileFlow = useCallback(() => {
    setDestination("profile");
    setInlineError("");
    window.setTimeout(() => {
      profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl || busyAction) {
      return;
    }

      try {
        setBusyAction("copy");
        await navigator.clipboard.writeText(shareUrl);
        await recordShare().catch(() => null);
        toast.success("Link copied.");
        emitShareEvent({
          postId: resolvedPostId,
        action: "copy_link",
        destination: "copy",
      });
    } catch (err) {
      toast.error(err?.message || "Failed to copy link");
    } finally {
      setBusyAction("");
    }
  }, [busyAction, onShareCountChange, recordShare, resolvedPostId, shareUrl]);

  const handleMessengerShare = useCallback(
    async (target) => {
      const targetId = String(target?._id || "").trim();
      if (!post || !targetId || busyAction) {
        return;
      }

      try {
        setBusyAction(`messenger:${targetId}`);
        await sendChatMessage(targetId, {
          text: buildShareBody({
            note: caption,
            post,
            url: shareUrl,
          }),
        });
        await recordShare().catch(() => null);
        toast.success(`Sent to ${target?.name || target?.username || "Messenger"}.`);
        emitShareEvent({
          postId: resolvedPostId,
          action: "messenger",
          destination: "messenger",
          targetId,
        });
      } catch (err) {
        toast.error(err?.message || "Failed to send in Messenger");
      } finally {
        setBusyAction("");
      }
    },
    [busyAction, caption, post, recordShare, resolvedPostId, shareUrl]
  );

  const handleWhatsAppShare = useCallback(async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("whatsapp");
      window.open(
        `https://wa.me/?text=${encodeURIComponent(
          buildShareBody({
            note: caption,
            post,
            url: shareUrl,
            compact: true,
          })
        )}`,
        "_blank",
        "noopener,noreferrer"
      );
      await recordShare().catch(() => null);
      toast.success("Opened WhatsApp share.");
      emitShareEvent({
        postId: resolvedPostId,
        action: "whatsapp",
        destination: "whatsapp",
      });
    } catch (err) {
      toast.error(err?.message || "Unable to open WhatsApp share");
    } finally {
      setBusyAction("");
    }
  }, [busyAction, caption, post, recordShare, resolvedPostId, shareUrl]);

  const shareToStory = useCallback(async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("story");
      const form = new FormData();
      form.append(
        "caption",
        buildShareBody({
          note: caption,
          post,
          url: shareUrl,
          compact: true,
        })
      );
      form.append("visibility", mapPrivacyToStoryVisibility(privacy));
      await createStory(form);
      await recordShare().catch(() => null);
      finishSuccess(
        privacy === "private"
          ? "Shared to your story for friends."
          : "Shared to your story.",
        { action: "story", destination: "story" }
      );
    } catch (err) {
      toast.error(err?.message || "Failed to share to your story");
      setBusyAction("");
    }
  }, [busyAction, caption, finishSuccess, post, privacy, recordShare, shareUrl]);

  const shareToFeed = useCallback(async () => {
    if (!post || busyAction) {
      return;
    }

    try {
      setBusyAction("feed");
      const createdPost = await createPost({
        text: String(caption || "").trim(),
        visibility: privacy,
        privacy,
        sharedPost: {
          postId: resolvedPostId,
        },
      });
      await recordShare().catch(() => null);
      onShareCreated?.(createdPost);
      finishSuccess("Shared to your feed.", { action: "feed", sharedPostId: createdPost?._id });
    } catch (err) {
      toast.error(err?.message || "Failed to share to your feed");
      setBusyAction("");
    }
  }, [
    busyAction,
    caption,
    finishSuccess,
    onShareCreated,
    post,
    privacy,
    recordShare,
    resolvedPostId,
  ]);

  const shareToGroup = useCallback(async () => {
    if (!post || busyAction) {
      return;
    }

    if (!selectedGroup) {
      setInlineError("Choose a group first.");
      return;
    }

    try {
      setBusyAction("group");
      const nextShares = {
        ...groupShares,
        [selectedGroup.id]: {
          postId: resolvedPostId,
          groupName: selectedGroup.name,
          note: String(caption || "").trim(),
          sharedAt: new Date().toISOString(),
        },
      };

      setGroupShares(nextShares);
      writeStoredGroupShares(nextShares);
      await recordShare().catch(() => null);
      finishSuccess(`Shared to ${selectedGroup.name}.`, {
        action: "group",
        destination: "group",
        targetId: selectedGroup.id,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to share to this group");
      setBusyAction("");
    }
  }, [
    busyAction,
    caption,
    finishSuccess,
    groupShares,
    post,
    recordShare,
    resolvedPostId,
    selectedGroup,
  ]);

  const shareToProfile = useCallback(async () => {
    if (!post || busyAction) {
      return;
    }

    if (!selectedProfile?._id || !selectedProfile?.username) {
      setInlineError("Choose a friend first.");
      return;
    }

    try {
      setBusyAction("profile");
      await recordShare().catch(() => null);
      navigate(`/profile/${selectedProfile.username}`, {
        state: {
          sharedPost: {
            ...shareState,
            targetName: String(selectedProfile?.name || "").trim(),
            targetUsername: String(selectedProfile?.username || "").trim(),
            privacy,
            sharedAt: new Date().toISOString(),
          },
        },
      });
      emitShareEvent({
        postId: resolvedPostId,
        action: "profile",
        destination: "profile",
        targetId: selectedProfile._id,
      });
      resetState();
    } catch (err) {
      toast.error(err?.message || "Failed to open this profile share");
      setBusyAction("");
    }
  }, [
    busyAction,
    navigate,
    post,
    privacy,
    recordShare,
    resetState,
    resolvedPostId,
    selectedProfile,
    shareState,
  ]);

  const handlePrimaryShare = useCallback(async () => {
    setInlineError("");

    if (destination === "story") {
      await shareToStory();
      return;
    }

    if (destination === "group") {
      await shareToGroup();
      return;
    }

    if (destination === "profile") {
      await shareToProfile();
      return;
    }

    await shareToFeed();
  }, [destination, shareToFeed, shareToGroup, shareToProfile, shareToStory]);

  const quickActions = useMemo(
    () => [
      {
        id: "messenger",
        label: "Messenger",
        onClick: focusMessenger,
        disabled: contactsLoading,
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        onClick: handleWhatsAppShare,
        disabled: Boolean(busyAction),
      },
      {
        id: "story",
        label: "Your story",
        onClick: shareToStory,
        disabled: Boolean(busyAction),
      },
      {
        id: "copy",
        label: "Copy link",
        onClick: handleCopyLink,
        disabled: Boolean(busyAction),
      },
      {
        id: "group",
        label: "Group",
        onClick: focusGroupFlow,
        disabled: Boolean(busyAction),
      },
      {
        id: "profile",
        label: "Friend's profile",
        onClick: focusProfileFlow,
        disabled: Boolean(busyAction),
      },
    ],
    [
      busyAction,
      contactsLoading,
      focusGroupFlow,
      focusMessenger,
      focusProfileFlow,
      handleCopyLink,
      handleWhatsAppShare,
      shareToStory,
    ]
  );

  if (!shouldRender || typeof document === "undefined") {
    return null;
  }

  const modal = (
    <div
      className={`tg-share-modal-backdrop${open ? " is-open" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <section
        ref={modalRef}
        className={`tg-share-modal${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tg-share-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="tg-share-modal-header">
          <h2 id="tg-share-modal-title">Share</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="tg-share-close-btn"
            onClick={requestClose}
            aria-label="Close share dialog"
          >
            ×
          </button>
        </header>

        <div className="tg-share-modal-body">
          {loading ? (
            <div className="tg-share-status-card">
              <strong>Loading share options...</strong>
              <p>Getting the post and your share destinations ready.</p>
            </div>
          ) : error ? (
            <div className="tg-share-status-card error">
              <strong>Could not load this post.</strong>
              <p>{error}</p>
            </div>
          ) : (
            <>
              <ShareComposerHeader
                user={user}
                destination={destination}
                onDestinationChange={setDestination}
                privacy={privacy}
                onPrivacyChange={setPrivacy}
                privacyDisabled={Boolean(busyAction)}
                helperText={helperText}
              />

              <section className="tg-share-composer-card">
                <label className="sr-only" htmlFor="tg-share-caption">
                  Share caption
                </label>
                <textarea
                  ref={captionRef}
                  id="tg-share-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Say something about this..."
                  maxLength={320}
                />
                <div className="tg-share-composer-footer">
                  <div className="tg-share-composer-tools">
                    <button
                      type="button"
                      className="tg-share-tool-btn"
                      onClick={() => {
                        setCaption((current) => `${current}${current ? " " : ""}😊`);
                        captionRef.current?.focus();
                      }}
                    >
                      <span aria-hidden="true">☺</span>
                      <span>Add emoji</span>
                    </button>
                  </div>
                  <span className="tg-share-counter">{caption.length}/320</span>
                </div>
              </section>

              <SharePreviewCard post={post} />

              <QuickShareActions items={quickActions} />

              <SuggestedShareTargets
                targets={filteredMessengerTargets.slice(0, 8)}
                loading={contactsLoading}
                onSelect={handleMessengerShare}
              />

              <section className="tg-share-section">
                <div className="tg-share-section-head">
                  <div>
                    <h3>Send in Messenger</h3>
                    <p>Search friends or recent chats and send this post directly.</p>
                  </div>
                </div>

                <label className="tg-share-search">
                  <span className="sr-only">Search share targets</span>
                  <input
                    ref={messengerSearchRef}
                    value={messengerSearch}
                    onChange={(event) => setMessengerSearch(event.target.value)}
                    placeholder="Search friends and chats"
                  />
                </label>

                {filteredMessengerTargets.length > 0 ? (
                  <div className="tg-share-contact-list">
                    {filteredMessengerTargets.slice(0, 6).map((target) => (
                      <TargetCard
                        key={`contact-${target._id}`}
                        title={target.name || target.username || "Friend"}
                        subtitle={
                          target.username ? `@${target.username}` : "Available in Messenger"
                        }
                        badge={
                          busyAction === `messenger:${target._id}` ? "Sending..." : "Send"
                        }
                        disabled={Boolean(busyAction)}
                        onClick={() => handleMessengerShare(target)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="tg-share-empty">
                    No matching Messenger contacts yet. Add more friends or start a chat first.
                  </p>
                )}
              </section>

              {destination === "group" ? (
                <section ref={groupSectionRef} className="tg-share-section">
                  <div className="tg-share-section-head">
                    <div>
                      <h3>Choose a group</h3>
                      <p>Select where you want this share to land.</p>
                    </div>
                  </div>

                  <div className="tg-share-target-grid">
                    {orderedGroups.map((group) => (
                      <TargetCard
                        key={group.id}
                        title={group.name}
                        subtitle={group.note}
                        badge={groupShares?.[group.id]?.postId === resolvedPostId ? "Recent" : ""}
                        active={group.id === selectedGroupId}
                        disabled={Boolean(busyAction)}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setInlineError("");
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {destination === "profile" ? (
                <section ref={profileSectionRef} className="tg-share-section">
                  <div className="tg-share-section-head">
                    <div>
                      <h3>Choose a friend's profile</h3>
                      <p>Continue to a friend's profile and finish the share there.</p>
                    </div>
                  </div>

                  <label className="tg-share-search">
                    <span className="sr-only">Search friends</span>
                    <input
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search friends"
                    />
                  </label>

                  {profileTargets.length > 0 ? (
                    <div className="tg-share-target-grid">
                      {profileTargets.slice(0, 8).map((person) => (
                      <TargetCard
                        key={person._id}
                        title={person.name || person.username || "Friend"}
                        subtitle={person.username ? `@${person.username}` : "Friend"}
                        active={person._id === selectedProfileId}
                        disabled={Boolean(busyAction)}
                        onClick={() => {
                          setSelectedProfileId(person._id);
                          setInlineError("");
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="tg-share-empty">
                      No matching friends found for profile sharing.
                    </p>
                  )}
                </section>
              ) : null}
            </>
          )}
        </div>

        <footer className="tg-share-modal-footer">
          <div className="tg-share-footer-copy">
            {inlineError ? <p className="tg-share-inline-error">{inlineError}</p> : null}
            {!inlineError && destination === "group" && selectedGroup ? (
              <p>Sharing into {selectedGroup.name}.</p>
            ) : null}
            {!inlineError && destination === "profile" && selectedProfile ? (
              <p>
                Opening {selectedProfile.name || selectedProfile.username}
                {selectedProfile.username ? ` (@${selectedProfile.username})` : ""}.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="tg-share-submit-btn"
            onClick={() => {
              void handlePrimaryShare();
            }}
            disabled={disablePrimary}
          >
            {busyAction && ["feed", "story", "group", "profile"].includes(destination)
              ? "Working..."
              : primaryLabel}
          </button>
        </footer>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
