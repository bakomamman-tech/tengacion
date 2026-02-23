import { useEffect, useMemo, useState } from "react";
import { getBook, getTrack } from "../api";

export default function ShareContentModal({ open, onClose, onSubmit }) {
  const [itemType, setItemType] = useState("track");
  const [itemId, setItemId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setError("");
  }, [open]);

  const previewType = useMemo(
    () => (itemType === "book" ? "read" : "play"),
    [itemType]
  );

  if (!open) {
    return null;
  }

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

  const submit = () => {
    const cleanId = itemId.trim();
    if (!cleanId) {
      setError("Item id is required.");
      return;
    }

    onSubmit?.({
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
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Share Content</h3>
            <p className="text-sm text-slate-600">Attach a track or book to your message.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select
              value={itemType}
              onChange={(event) => setItemType(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
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
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
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

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          onClick={submit}
        >
          Share {itemType === "book" ? "Book" : "Track"}
        </button>
      </div>
    </div>
  );
}
