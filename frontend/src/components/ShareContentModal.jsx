import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getBook, getTrack } from "../api";

const EXTERNAL_TARGETS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "x", label: "X" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "snapchat", label: "Snapchat" },
];

const buildDefaultShareUrl = () => {
  if (typeof window === "undefined") {
    return "https://tengacion.onrender.com/home";
  }
  const base = window.location.origin || "https://tengacion.onrender.com";
  return `${base}/home`;
};

export default function ShareContentModal({
  open,
  onClose,
  onSubmit,
  contacts = [],
  onShareFollowers,
}) {
  const [itemType, setItemType] = useState("track");
  const [itemId, setItemId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [shareText, setShareText] = useState("Check this out on Tengacion");
  const [shareUrl, setShareUrl] = useState(buildDefaultShareUrl());
  const [search, setSearch] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setError("");
    setShareStatus("");
    setSearch("");
    setSelectedRecipients([]);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const previewType = useMemo(() => (itemType === "book" ? "read" : "play"), [itemType]);

  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return contacts;
    }
    return contacts.filter((entry) => {
      const name = String(entry?.name || "").toLowerCase();
      const username = String(entry?.username || "").toLowerCase();
      return name.includes(needle) || username.includes(needle);
    });
  }, [contacts, search]);

  const payload = useMemo(() => {
    const cleanId = itemId.trim();
    if (cleanId) {
      return {
        type: "contentCard",
        text: "",
        metadata: {
          itemType,
          itemId: cleanId,
          previewType,
          title: title.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          coverImageUrl: coverImageUrl.trim(),
        },
      };
    }

    const text = `${shareText.trim()} ${shareUrl.trim()}`.trim();
    return {
      type: "text",
      text: text || shareUrl.trim() || "Shared from Tengacion",
    };
  }, [coverImageUrl, description, itemId, itemType, previewType, price, shareText, shareUrl, title]);

  if (!open) {
    return null;
  }

  const toggleRecipient = (id) => {
    setSelectedRecipients((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  };

  const loadItem = async () => {
    const cleanId = itemId.trim();
    if (!cleanId) {
      setError("Enter an item id first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (itemType === "book") {
        const book = await getBook(cleanId);
        setTitle(book?.title || "");
        setDescription(book?.description || "");
        setPrice(Number(book?.price) || 0);
        setCoverImageUrl(book?.coverImageUrl || "");
      } else {
        const track = await getTrack(cleanId);
        setTitle(track?.title || "");
        setDescription(track?.description || "");
        setPrice(Number(track?.price) || 0);
        setCoverImageUrl("");
      }
    } catch (err) {
      setError(err.message || "Failed to load content item.");
    } finally {
      setLoading(false);
    }
  };

  const shareToFriends = () => {
    if (selectedRecipients.length === 0) {
      setError("Select at least one friend.");
      return;
    }

    onSubmit?.({
      mode: "friends",
      recipientIds: selectedRecipients,
      payload,
    });
  };

  const shareToFollowers = async () => {
    if (typeof onShareFollowers !== "function") {
      setError("Followers sharing is not available.");
      return;
    }

    setLoading(true);
    setError("");
    setShareStatus("");

    try {
      const result = await onShareFollowers(payload);
      setShareStatus(
        Number(result?.sent) > 0
          ? `Shared to ${result.sent} follower(s).`
          : "No followers available for sharing."
      );
    } catch (err) {
      setError(err?.message || "Failed to share to followers");
    } finally {
      setLoading(false);
    }
  };

  const openExternal = async (target) => {
    const text = shareText.trim() || "Shared from Tengacion";
    const url = shareUrl.trim() || buildDefaultShareUrl();
    const combined = `${text} ${url}`.trim();

    if (target === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(combined)}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    if (target === "x") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus(`Link copied. Open ${target} and paste it.`);
      if (target === "instagram") {
        window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      }
      if (target === "tiktok") {
        window.open("https://www.tiktok.com/", "_blank", "noopener,noreferrer");
      }
      if (target === "snapchat") {
        window.open("https://www.snapchat.com/", "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Could not copy link. Please copy manually.");
    }
  };

  const useWebShare = async () => {
    const text = shareText.trim() || "Shared from Tengacion";
    const url = shareUrl.trim() || buildDefaultShareUrl();

    if (!navigator.share) {
      setError("Native share is not supported on this browser.");
      return;
    }

    try {
      await navigator.share({
        title: title.trim() || "Tengacion",
        text,
        url,
      });
      setShareStatus("Shared successfully.");
    } catch {
      // user cancelled
    }
  };

  const modal = (
    <div
      className="share-modal-backdrop fixed inset-0 flex items-center justify-center bg-slate-950/60 px-4"
      onMouseDown={() => onClose?.()}
    >
      <div
        className="share-modal-panel w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Share</h3>
            <p className="text-sm text-slate-600">Share inside Tengacion or to external apps.</p>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-slate-200 bg-transparent p-0 text-lg leading-none text-slate-700 hover:bg-black/10 dark:hover:bg-white/10"
            onClick={onClose}
            aria-label="Close share"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Share text</span>
            <input
              value={shareText}
              onChange={(event) => setShareText(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Share URL</span>
            <input
              value={shareUrl}
              onChange={(event) => setShareUrl(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
            />
          </label>

          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Attach Tengacion content card (optional)
            </summary>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Type</span>
                <select
                  value={itemType}
                  onChange={(event) => setItemType(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                >
                  <option value="track">Track</option>
                  <option value="book">Book</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Item ID</span>
                <div className="flex gap-2">
                  <input
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    placeholder="Mongo item id"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={loadItem}
                    disabled={loading}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading ? "Loading..." : "Load"}
                  </button>
                </div>
              </label>
            </div>
          </details>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Share inside Tengacion</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={shareToFollowers}
                disabled={loading}
              >
                Share to Followers
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search friends"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
              />
              <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 p-2">
                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-slate-500">No contacts available</p>
                ) : (
                  filteredContacts.map((entry) => {
                    const id = String(entry?._id || "");
                    return (
                      <label key={id} className="mb-1 flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(id)}
                          onChange={() => toggleRecipient(id)}
                        />
                        <span>{entry?.name || entry?.username || "User"}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={shareToFriends}
                disabled={loading}
              >
                Share to Friends
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Share to external apps</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={useWebShare}
              >
                Native Share
              </button>
              {EXTERNAL_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => openExternal(target.id)}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {shareStatus ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {shareStatus}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}
