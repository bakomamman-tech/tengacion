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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/30 bg-[linear-gradient(180deg,rgba(255,255,252,0.98),rgba(244,238,225,0.98))] shadow-[0_28px_90px_rgba(12,32,19,0.35)]">
        <div className="border-b border-emerald-950/10 bg-[radial-gradient(circle_at_top_right,rgba(25,86,52,0.12),transparent_42%)] p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
                Paystack checkout
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h3>
              {subtitle ? (
                <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Securely unlock this release with Paystack.
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="rounded-2xl border border-brand-200 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {currency} {Number(price || 0).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800">
              <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1">Card</span>
              <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1">USSD</span>
              <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1">Bank transfer</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,64,39,0.24)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onBuy}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Opening secure checkout...
              </>
            ) : (
              "Continue to Paystack"
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Card, USSD, and bank transfer are collected securely inside Paystack.
          </p>
        </div>
      </div>
    </div>
  );
}
