export default function PaywallModal({
  open,
  title = "Unlock content",
  subtitle = "",
  price = 0,
  currency = "NGN",
  loading = false,
  error = "",
  onClose,
  onBuy,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Paywall</h3>
            <p className="mt-1 text-sm text-slate-600">{title}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {subtitle ? <p className="mb-4 text-sm text-slate-600">{subtitle}</p> : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {currency} {Number(price || 0).toLocaleString()}
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={onBuy}
          disabled={loading}
        >
          {loading ? "Redirecting to Paystack..." : "Buy now"}
        </button>
      </div>
    </div>
  );
}
