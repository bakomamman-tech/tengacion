import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getMyPurchases, resolveImage } from "../../api";
import {
  normalizePurchaseType,
  resolveOwnedPurchaseLabel,
} from "../../utils/purchaseUx";

const formatMoney = (value = 0, currency = "NGN") => {
  const amount = Number(value || 0);
  return amount > 0 ? `${String(currency || "NGN").toUpperCase()} ${amount.toLocaleString()}` : "Free";
};

const formatDate = (value) => {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const pick = (...values) => values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== "");

const normalizePurchases = (response) => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.purchases)) {
    return response.purchases;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return [];
};

const getTypeLabel = (purchase) => {
  const type = normalizePurchaseType(
    pick(purchase?.productType, purchase?.itemType, purchase?.contentType, purchase?.mediaType, purchase?.type)
  );
  if (type === "track") {
    return "Music";
  }
  if (type === "book") {
    return "Books";
  }
  if (type === "podcast") {
    return "Podcasts";
  }
  if (type === "album") {
    return "Albums";
  }
  return "Other";
};

const getActionTarget = (purchase, navigate) => {
  const type = normalizePurchaseType(
    pick(purchase?.productType, purchase?.itemType, purchase?.contentType, purchase?.mediaType, purchase?.type)
  );
  const id = String(pick(purchase?.productId, purchase?.itemId, purchase?.contentId, purchase?._id) || "").trim();
  const route = String(pick(purchase?.route, purchase?.itemRoute, purchase?.contentRoute, purchase?.purchaseUrl) || "").trim();
  const streamUrl = String(pick(purchase?.streamUrl, purchase?.audioUrl, purchase?.playUrl) || "").trim();
  const downloadUrl = String(pick(purchase?.downloadUrl, purchase?.fileUrl) || "").trim();
  const creatorId = String(pick(purchase?.creatorId, purchase?.creator?._id) || "").trim();

  if (downloadUrl) {
    return {
      label: type === "book" ? "Read now" : type === "album" ? "Download bundle" : "Download now",
      onClick: () => window.open(downloadUrl, "_blank", "noopener,noreferrer"),
    };
  }

  if (streamUrl) {
    return {
      label: resolveOwnedPurchaseLabel(purchase),
      onClick: () => window.open(streamUrl, "_blank", "noopener,noreferrer"),
    };
  }

  if (route) {
    const isExternal = /^https?:\/\//i.test(route) || route.startsWith("//");
    return {
      label: resolveOwnedPurchaseLabel(purchase),
      onClick: () => {
        if (isExternal) {
          window.open(route, "_blank", "noopener,noreferrer");
          return;
        }
        navigate(route);
      },
    };
  }

  if (type === "track" && id) {
    return {
      label: "Listen now",
      onClick: () => navigate(`/tracks/${id}`),
    };
  }

  if (type === "book" && id) {
    return {
      label: "Read now",
      onClick: () => navigate(`/books/${id}`),
    };
  }

  if (type === "podcast" && creatorId) {
    return {
      label: "Listen now",
      onClick: () => navigate(`/creator/${creatorId}`),
    };
  }

  if (type === "album" && id) {
    return {
      label: "Open album",
      onClick: () => navigate(`/albums/${id}`),
    };
  }

  return {
    label: "Open",
    onClick: () => navigate("/home"),
  };
};

function PurchaseSection({ title, items, emptyMessage, navigate }) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/75 p-5 shadow-[0_18px_50px_rgba(61,45,17,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{items.length} items</p>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 grid gap-4">
          {items.map((purchase) => {
            const action = getActionTarget(purchase, navigate);
            const typeLabel = getTypeLabel(purchase);
            const coverUrl = resolveImage(
              pick(purchase?.coverUrl, purchase?.coverImage, purchase?.artworkUrl, purchase?.artwork)
            );
            const titleText = String(
              pick(purchase?.productTitle, purchase?.title, purchase?.name, purchase?.contentTitle) || "Untitled purchase"
            );
            const creatorName = String(
              pick(purchase?.creatorName, purchase?.creator?.displayName, purchase?.creator?.name, purchase?.creator?.username) || "Creator"
            );
            const dateText = formatDate(
              pick(purchase?.paidAt, purchase?.purchasedAt, purchase?.createdAt, purchase?.completedAt)
            );
            const amount = Number(pick(purchase?.amount, purchase?.grossAmount, purchase?.price) || 0);
            const currency = String(pick(purchase?.currency, "NGN") || "NGN").toUpperCase();

            return (
              <article
                key={`${typeLabel}-${purchase?.reference || purchase?._id || titleText}`}
                className="grid gap-4 rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] sm:grid-cols-[92px,1fr,auto]"
              >
                <div className="h-24 w-24 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                  {coverUrl ? (
                    <img src={coverUrl} alt={titleText} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#e7f4ea_0%,#d8e9dd_100%)] text-lg font-bold text-brand-800">
                      {titleText.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800">
                      {typeLabel}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {pick(purchase?.status, purchase?.paymentStatus, "Verified")}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-lg font-semibold text-slate-900">{titleText}</h3>
                  <p className="mt-1 text-sm text-slate-600">{creatorName}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>Purchased {dateText}</span>
                    <span>{formatMoney(amount, currency)}</span>
                    {purchase?.reference ? <span className="break-all">Ref {purchase.reference}</span> : null}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3 sm:items-end">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,64,39,0.2)] transition hover:bg-brand-700"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                  {purchase?.reference ? (
                    <span className="text-xs text-slate-500">Verified payment</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-sm text-slate-600">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export default function MyPurchasesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const nextPayload = await getMyPurchases();
        if (!cancelled) {
          setPayload(nextPayload || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load your purchases.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const purchases = useMemo(() => normalizePurchases(payload), [payload]);
  const groups = useMemo(() => {
    const grouped = new Map();
    purchases.forEach((purchase) => {
      const key = getTypeLabel(purchase);
      grouped.set(key, [...(grouped.get(key) || []), purchase]);
    });
    return grouped;
  }, [purchases]);

  const totalSpent = useMemo(
    () =>
      purchases.reduce(
        (sum, purchase) => sum + Number(pick(purchase?.amount, purchase?.grossAmount, purchase?.price) || 0),
        0
      ),
    [purchases]
  );

  const summaryCards = [
    ["Total purchases", purchases.length],
    ["Music", groups.get("Music")?.length || 0],
    ["Books", groups.get("Books")?.length || 0],
    ["Podcasts", groups.get("Podcasts")?.length || 0],
  ];
  const sectionOrder = ["Music", "Books", "Podcasts", "Albums", "Other"];

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
          Loading your purchases...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50/90 p-6 text-sm text-rose-800 shadow-sm">
          <p className="font-semibold">Couldn't load purchases</p>
          <p className="mt-2">{error}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,64,39,0.2)] transition hover:bg-brand-700"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <Link
              to="/home"
              className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,#fffdf7_0%,#f4efe2_100%)] p-6 shadow-[0_24px_80px_rgba(58,42,18,0.14)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">Purchases</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Your verified library</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Every paid track, book, and podcast you've already unlocked appears here once Paystack verification completes.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-white/85 px-4 py-3 text-right shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total spent</p>
            <strong className="mt-1 block text-2xl text-slate-900">{formatMoney(totalSpent)}</strong>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-brand-200 bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <strong className="mt-1 block text-2xl text-slate-900">{Number(value || 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        {Array.from(groups.entries()).length ? (
          sectionOrder
            .filter((label) => (groups.get(label) || []).length)
            .map((label) => (
              <PurchaseSection
                key={label}
                title={label}
                items={groups.get(label) || []}
                emptyMessage={`No ${label.toLowerCase()} purchases yet.`}
                navigate={navigate}
              />
            ))
        ) : (
          <section className="rounded-[2rem] border border-dashed border-brand-200 bg-white/75 p-8 text-center text-sm text-slate-600 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No purchases yet</p>
            <p className="mt-2">Buy a track, book, or podcast and it will appear here after Paystack verification.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                to="/home"
                className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,64,39,0.2)] transition hover:bg-brand-700"
              >
                Browse home
              </Link>
              <Link
                to="/find-creators"
                className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
              >
                Find creators
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
