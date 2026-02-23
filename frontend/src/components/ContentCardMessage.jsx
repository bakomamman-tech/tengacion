import { useNavigate } from "react-router-dom";

export default function ContentCardMessage({ metadata = {}, onPreview }) {
  const navigate = useNavigate();

  const itemType = metadata.itemType === "book" ? "book" : "track";
  const itemId = metadata.itemId || "";
  const title = metadata.title || (itemType === "book" ? "Book" : "Track");
  const description = metadata.description || "";
  const price = Number(metadata.price) || 0;
  const coverImageUrl = metadata.coverImageUrl || "";

  const openPreview = () => {
    if (typeof onPreview === "function") {
      onPreview({ itemType, itemId });
      return;
    }

    const nextPath =
      itemType === "book"
        ? `/books/${encodeURIComponent(itemId)}`
        : `/tracks/${encodeURIComponent(itemId)}`;
    navigate(nextPath);
  };

  return (
    <article className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-slate-500">
              {itemType}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-slate-600">{description}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium text-slate-700">NGN {price.toLocaleString()}</p>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        onClick={openPreview}
      >
        {itemType === "book" ? "Read preview" : "Play preview"}
      </button>
    </article>
  );
}
