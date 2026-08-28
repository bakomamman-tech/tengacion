import { useMemo, useState } from "react";

import {
  createCreatorLaunchPlan,
  createCreatorReferral,
  updateCreatorLaunchPlan,
} from "../../api";

import "./creator-launch-planner.css";

const EMPTY_FORM = {
  title: "",
  playbookType: "first_paid_music_drop",
  offerType: "paid_drop",
  launchAt: "",
  price: "",
  coverReady: false,
  previewReady: false,
  announcementDraft: "",
  fanUpdatePlan: "",
};

const label = (value = "") => String(value || "")
  .split("_")
  .filter(Boolean)
  .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
  .join(" ");

export default function CreatorLaunchPlannerPanel({
  businessSuite = {},
  creatorProfile = {},
  onRefresh = async () => {},
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const playbooks = useMemo(
    () => (Array.isArray(businessSuite.playbooks) ? businessSuite.playbooks : []),
    [businessSuite.playbooks]
  );
  const plans = Array.isArray(businessSuite.plans) ? businessSuite.plans : [];
  const selectedPlaybook = useMemo(
    () => playbooks.find((playbook) => playbook.key === form.playbookType) || playbooks[0] || null,
    [form.playbookType, playbooks]
  );
  const allowedOffers = selectedPlaybook?.offerTypes || businessSuite.offerTypes || [];

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectPlaybook = (playbookType) => {
    const playbook = playbooks.find((item) => item.key === playbookType);
    setForm((current) => ({
      ...current,
      playbookType,
      offerType: playbook?.offerTypes?.[0] || current.offerType,
    }));
  };

  const createPlan = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.launchAt || Number(form.price || 0) <= 0) {
      setNotice("Add a title, launch date, and positive offer price before creating the plan.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      await createCreatorLaunchPlan({
        ...form,
        title: form.title.trim(),
        price: Number(form.price || 0),
        launchAt: new Date(form.launchAt).toISOString(),
        successMetric: selectedPlaybook?.postLaunchReviewMetric || "launch_conversion_and_repeat_action",
      });
      setForm(EMPTY_FORM);
      setNotice("Launch plan created. Complete its real readiness checklist before scheduling.");
      await onRefresh();
    } catch (error) {
      setNotice(error?.message || "Failed to create the launch plan.");
    } finally {
      setSaving(false);
    }
  };

  const completeNextStep = async (plan) => {
    const next = (plan.checklist || []).find((item) => !item.complete);
    if (!next) {return;}
    setSaving(true);
    setNotice("");
    try {
      await updateCreatorLaunchPlan(plan.id, {
        checklist: (plan.checklist || []).map((item) => ({
          key: item.key,
          complete: item.key === next.key ? true : item.complete,
        })),
      });
      setNotice(`${next.label} marked complete.`);
      await onRefresh();
    } catch (error) {
      setNotice(error?.message || "Failed to update the launch checklist.");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (plan) => {
    setSaving(true);
    setNotice("");
    try {
      await updateCreatorLaunchPlan(plan.id, {
        status: "review_required",
        reason: "Creator submitted the elevated-risk launch for campaign, finance, or trust review.",
      });
      setNotice("Plan submitted for human review. Akuso cannot approve or publish it.");
      await onRefresh();
    } catch (error) {
      setNotice(error?.message || "Failed to submit the plan for review.");
    } finally {
      setSaving(false);
    }
  };

  const createShareLink = async () => {
    setSaving(true);
    setNotice("");
    try {
      const username = creatorProfile?.user?.username || creatorProfile?.username || "";
      const payload = await createCreatorReferral({
        sourceType: "creator_profile_share",
        sourceKey: username || "creator_profile",
        destinationPath: username ? `/creator/${encodeURIComponent(username)}` : "/home",
        label: "Creator profile share",
      });
      const relativePath = payload?.referral?.sharePath || "";
      const absoluteUrl = relativePath && typeof window !== "undefined"
        ? new URL(relativePath, window.location.origin).toString()
        : relativePath;
      setShareUrl(absoluteUrl);
      if (absoluteUrl && navigator.clipboard?.writeText) {await navigator.clipboard.writeText(absoluteUrl);}
      setNotice("Privacy-safe creator share link created and copied.");
      await onRefresh();
    } catch (error) {
      setNotice(error?.message || "Failed to create a creator share link.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="creator-panel creator-launch-planner" data-testid="creator-launch-planner">
      <div className="creator-panel-head">
        <div>
          <h2>Launch planner & offer builder</h2>
          <p>Prepare a repeatable launch from a real playbook. Elevated finance, campaign, live, marketplace, and trust risk stays human-reviewed.</p>
        </div>
        <span className="creator-status-badge neutral">
          {Number(businessSuite.summary?.activePlans || 0)} active
        </span>
      </div>

      <div className="creator-launch-playbook-grid" aria-label="Creator launch playbooks">
        {playbooks.map((playbook) => (
          <button
            key={playbook.key}
            type="button"
            className={`creator-launch-playbook${form.playbookType === playbook.key ? " is-selected" : ""}`}
            onClick={() => selectPlaybook(playbook.key)}
          >
            <strong>{playbook.title}</strong>
            <span>{playbook.pricingGuidance}</span>
            <small>{playbook.readinessState === "ready" ? "Ready to plan" : `${playbook.blockers?.length || 0} readiness gaps`}</small>
          </button>
        ))}
      </div>

      <form className="creator-launch-form" onSubmit={createPlan}>
        <label>
          <span>Launch title</span>
          <input value={form.title} onChange={(event) => updateField("title", event.target.value)} maxLength={180} placeholder="Name this launch" />
        </label>
        <label>
          <span>Offer type</span>
          <select value={form.offerType} onChange={(event) => updateField("offerType", event.target.value)}>
            {allowedOffers.map((offer) => <option key={offer} value={offer}>{label(offer)}</option>)}
          </select>
        </label>
        <label>
          <span>Launch date</span>
          <input type="datetime-local" value={form.launchAt} onChange={(event) => updateField("launchAt", event.target.value)} />
        </label>
        <label>
          <span>Price (NGN)</span>
          <input type="number" min="1" step="1" value={form.price} onChange={(event) => updateField("price", event.target.value)} placeholder="2000" />
        </label>
        <label className="creator-launch-form__wide">
          <span>Announcement draft</span>
          <textarea value={form.announcementDraft} onChange={(event) => updateField("announcementDraft", event.target.value)} maxLength={3000} rows={3} placeholder="Draft copy for your review before publishing" />
        </label>
        <label className="creator-launch-form__wide">
          <span>Fan update plan</span>
          <textarea value={form.fanUpdatePlan} onChange={(event) => updateField("fanUpdatePlan", event.target.value)} maxLength={1200} rows={2} placeholder="Channels, reminder frequency, opt-out and support path" />
        </label>
        <label className="creator-launch-check"><input type="checkbox" checked={form.coverReady} onChange={(event) => updateField("coverReady", event.target.checked)} /><span>Cover ready</span></label>
        <label className="creator-launch-check"><input type="checkbox" checked={form.previewReady} onChange={(event) => updateField("previewReady", event.target.checked)} /><span>Preview ready</span></label>
        <div className="creator-launch-actions creator-launch-form__wide">
          <button type="submit" className="creator-primary-btn" disabled={saving}>{saving ? "Saving..." : "Create launch plan"}</button>
          <button type="button" className="creator-secondary-btn" onClick={createShareLink} disabled={saving}>Create profile share link</button>
        </div>
      </form>

      {notice ? <div className="creator-launch-notice" role="status">{notice}</div> : null}
      {shareUrl ? <div className="creator-launch-share"><strong>Share link</strong><span>{shareUrl}</span></div> : null}

      <div className="creator-launch-plan-list">
        {plans.map((plan) => {
          const nextStep = (plan.checklist || []).find((item) => !item.complete);
          return (
            <article key={plan.id} className="creator-launch-plan-card">
              <div>
                <strong>{plan.title}</strong>
                <p>{label(plan.offerType)} · {label(plan.status)} · {plan.currency} {Number(plan.price || 0).toLocaleString()}</p>
                <small>{nextStep ? `Next: ${nextStep.label}` : plan.blockers?.length ? `Blocked by ${plan.blockers.join(", ")}` : "Checklist complete"}</small>
              </div>
              <div className="creator-launch-actions">
                {nextStep ? <button type="button" className="creator-secondary-btn" onClick={() => completeNextStep(plan)} disabled={saving}>Complete next step</button> : null}
                {plan.riskLevel === "elevated" && plan.status === "planning" ? <button type="button" className="creator-secondary-btn" onClick={() => submitForReview(plan)} disabled={saving}>Submit for review</button> : null}
              </div>
            </article>
          );
        })}
        {!plans.length ? <div className="creator-empty-card">No launch plans yet. Choose the playbook that matches your next earning cycle.</div> : null}
      </div>
    </section>
  );
}
