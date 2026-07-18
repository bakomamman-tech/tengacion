import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import {
  adminApproveBook,
  adminGetBookReview,
  adminListContent,
  adminPublishAlbum,
  adminPublishTrack,
  adminPublishVideo,
  resolveImage,
} from "../api";

const CATEGORY_OPTIONS = [
  ["all", "All Content"],
  ["music", "Music"],
  ["albums", "Albums"],
  ["books", "Books"],
  ["podcasts", "Podcasts"],
  ["videos", "Videos"],
];

const STATUS_OPTIONS = [
  ["all", "All Statuses"],
  ["published", "Published"],
  ["draft", "Draft"],
  ["under_review", "Under Review"],
  ["blocked", "Blocked"],
  ["review_required", "Review Required"],
];

const STATUS_LABELS = {
  published: "Published",
  draft: "Draft",
  under_review: "Under review",
  blocked: "Blocked",
  review_required: "Review required",
  pending_scan: "Pending scan",
  passed: "Passed",
  flagged: "Needs review",
};

const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const formatStatus = (value) => STATUS_LABELS[String(value || "").toLowerCase()] || value || "-";

const formatCurrency = (value, currency = "NGN") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "NGN").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "NGN"} ${Number(value || 0).toLocaleString()}`;
  }
};

const isTrackLike = (entry = {}) => entry.type === "track" || entry.type === "podcast";

const isSubmittedForReview = (entry = {}) => {
  const status = String(entry.status || "").toLowerCase();
  return status !== "draft" && (status === "under_review" || Boolean(entry.reviewRequired));
};

const isReviewableBook = (entry = {}) =>
  entry.type === "book" && isSubmittedForReview(entry);

const isPublishableAlbum = (entry = {}) => {
  const status = String(entry.status || "").toLowerCase();
  return entry.type === "album" && !["published", "blocked"].includes(status) && isSubmittedForReview(entry);
};

const isPublishableTrack = (entry = {}) => {
  const status = String(entry.status || "").toLowerCase();
  return isTrackLike(entry) && !["published", "blocked"].includes(status) && isSubmittedForReview(entry);
};

const isPublishableVideo = (entry = {}) => {
  const status = String(entry.status || "").toLowerCase();
  return entry.type === "video" && !["published", "blocked"].includes(status) && isSubmittedForReview(entry);
};

const getTrackPublishBlock = (entry = {}) => {
  if (!isPublishableTrack(entry)) {
    return "";
  }
  if (entry.audioAvailable === false) {
    return "Missing audio";
  }
  return "";
};

const getTrackPublishLabel = (entry = {}) => {
  if (entry.type === "podcast") {
    return "Approve episode";
  }
  return "Approve track";
};

export default function AdminContentPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(() => searchParams.get("category") || "all");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState({ items: [], total: 0, limit: 20, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [reviewBook, setReviewBook] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNote, setReviewNote] = useState("Rights and manuscript reviewed by Admin.");
  const [publishBusyKey, setPublishBusyKey] = useState("");
  const [albumReview, setAlbumReview] = useState(null);
  const [audioReview, setAudioReview] = useState(null);
  const [videoReview, setVideoReview] = useState(null);

  useEffect(() => {
    const nextCategory = searchParams.get("category") || "all";
    const nextStatus = searchParams.get("status") || "all";
    setCategory((current) => (current === nextCategory ? current : nextCategory));
    setStatus((current) => (current === nextStatus ? current : nextStatus));
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminListContent({ category, status, page, limit: 20 });
      setPayload(next || { items: [], total: 0, limit: 20, page: 1 });
    } catch (err) {
      setError(err?.message || "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [category, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilters = (next = {}) => {
    const nextCategory = next.category ?? category;
    const nextStatus = next.status ?? status;
    const params = new URLSearchParams();
    if (nextCategory && nextCategory !== "all") {
      params.set("category", nextCategory);
    }
    if (nextStatus && nextStatus !== "all") {
      params.set("status", nextStatus);
    }
    setCategory(nextCategory);
    setStatus(nextStatus);
    setPage(1);
    setSearchParams(params, { replace: true });
  };

  const openBookReview = async (entry) => {
    setReviewBook({ id: entry.id, title: entry.title, status: entry.status });
    setReviewLoading(true);
    setReviewBusy(false);
    setReviewError("");
    setStatusMessage("");
    setReviewNote("Rights and manuscript reviewed by Admin.");
    try {
      const detail = await adminGetBookReview(entry.id);
      setReviewBook(detail?.book || null);
    } catch (err) {
      setReviewError(err?.message || "Failed to load manuscript review");
    } finally {
      setReviewLoading(false);
    }
  };

  const closeBookReview = () => {
    if (reviewBusy) {
      return;
    }
    setReviewBook(null);
    setReviewError("");
    setStatusMessage("");
  };

  const openManuscript = (book = reviewBook) => {
    const url = resolveImage(book?.manuscriptUrl || "");
    if (!url) {
      setReviewError("This book does not have a manuscript URL.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const approveBook = async () => {
    if (!reviewBook?.id) {
      return;
    }
    setReviewBusy(true);
    setReviewError("");
    setStatusMessage("");
    try {
      const result = await adminApproveBook(reviewBook.id, { reason: reviewNote });
      setReviewBook(result?.book || reviewBook);
      setStatusMessage("Book approved. Buyers can now open the book page and purchase it.");
      await load();
    } catch (err) {
      setReviewError(err?.message || "Failed to approve book");
    } finally {
      setReviewBusy(false);
    }
  };

  const publishAlbum = async (entry) => {
    if (!entry?.id) {
      return;
    }
    const busyKey = `album-${entry.id}`;
    setPublishBusyKey(busyKey);
    setError("");
    setStatusMessage("");
    try {
      await adminPublishAlbum(entry.id, {
        reason: "Album rights, track playback and release metadata reviewed by Admin.",
      });
      setStatusMessage(`${entry.title || "Album"} is now published.`);
      setAlbumReview(null);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to approve album");
    } finally {
      setPublishBusyKey("");
    }
  };

  const publishTrack = async (entry) => {
    if (!entry?.id) {
      return;
    }
    const busyKey = `${entry.type}-${entry.id}`;
    setPublishBusyKey(busyKey);
    setError("");
    setStatusMessage("");
    try {
      const note = entry.type === "podcast"
        ? "Audio rights and episode metadata reviewed by Admin."
        : "Audio rights and release metadata reviewed by Admin.";
      await adminPublishTrack(entry.id, { reason: note });
      setStatusMessage(`${entry.title || "Track"} is now published.`);
      setAudioReview(null);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to publish track");
    } finally {
      setPublishBusyKey("");
    }
  };

  const publishVideo = async (entry) => {
    if (!entry?.id) {
      return;
    }
    const busyKey = `video-${entry.id}`;
    setPublishBusyKey(busyKey);
    setError("");
    setStatusMessage("");
    try {
      await adminPublishVideo(entry.id, {
        reason: "Video rights, playback and release metadata reviewed by Admin.",
      });
      setStatusMessage(`${entry.title || "Video"} is now published.`);
      setVideoReview(null);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to approve video");
    } finally {
      setPublishBusyKey("");
    }
  };

  const totalPages = Math.max(1, Math.ceil((payload.total || 0) / (payload.limit || 20)));
  const canApproveReviewBook = reviewBook && isSubmittedForReview(reviewBook);
  const modalOpen = reviewLoading || reviewBook;

  return (
    <AdminShell
      title="Content"
      subtitle="All creator uploads across music, albums, books, podcasts, and videos."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          <select className="adminx-select" value={category} onChange={(e) => updateFilters({ category: e.target.value })}>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="adminx-select" value={status} onChange={(e) => updateFilters({ status: e.target.value })}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {statusMessage ? <div className="adminx-loading">{statusMessage}</div> : null}
      {loading ? <div className="adminx-loading">Loading content...</div> : null}

      {!loading ? (
        <section className="adminx-table-wrap">
          <table className="adminx-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Moderation</th>
                <th>Performance</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payload.items || []).map((entry) => (
                <tr key={`${entry.type}-${entry.id}`}>
                  <td>{entry.type}</td>
                  <td>
                    <div>{entry.title}</div>
                    {entry.authorName ? <div className="adminx-muted">by {entry.authorName}</div> : null}
                  </td>
                  <td>{formatStatus(entry.status)}</td>
                  <td>
                    <div>{entry.moderationStatus || "ALLOW"}</div>
                    {entry.reviewRequired ? <div className="adminx-muted">review required</div> : null}
                    {entry.copyrightScanStatus ? <div className="adminx-muted">{formatStatus(entry.copyrightScanStatus)}</div> : null}
                    {entry.sensitiveType ? <div className="adminx-muted">{entry.sensitiveType}</div> : null}
                  </td>
                  <td>{Number(entry.metricValue || 0).toLocaleString()}</td>
                  <td>{dateTime(entry.createdAt)}</td>
                  <td>
                    {isReviewableBook(entry) ? (
                      <button type="button" className="adminx-btn adminx-btn--primary" onClick={() => openBookReview(entry)}>
                        Review manuscript
                      </button>
                    ) : isPublishableAlbum(entry) ? (
                      entry.tracksAvailable === false ? (
                        <span className="adminx-muted">Missing album tracks</span>
                      ) : (
                        <button
                          type="button"
                          className="adminx-btn adminx-btn--primary"
                          onClick={() => setAlbumReview(entry)}
                        >
                          Review {entry.releaseType === "ep" ? "EP" : "album"}
                        </button>
                      )
                    ) : isPublishableTrack(entry) ? (
                      getTrackPublishBlock(entry) ? (
                        <span className="adminx-muted">{getTrackPublishBlock(entry)}</span>
                      ) : (
                        <button
                          type="button"
                          className="adminx-btn adminx-btn--primary"
                          onClick={() => setAudioReview(entry)}
                        >
                          Review {entry.type === "podcast" ? "episode" : "track"}
                        </button>
                      )
                    ) : isPublishableVideo(entry) ? (
                      entry.videoAvailable === false ? (
                        <span className="adminx-muted">Missing video</span>
                      ) : (
                        <button
                          type="button"
                          className="adminx-btn adminx-btn--primary"
                          onClick={() => setVideoReview(entry)}
                        >
                          Review video
                        </button>
                      )
                    ) : (
                      <span className="adminx-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!(payload.items || []).length ? (
                <tr><td colSpan={7} className="adminx-table-empty">No content found.</td></tr>
              ) : null}
            </tbody>
          </table>
          <div className="adminx-row" style={{ padding: 12 }}>
            <span className="adminx-muted">Page {payload.page || page} of {totalPages}</span>
            <div className="adminx-action-row">
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</button>
              <button type="button" className="adminx-btn" onClick={() => setPage((prev) => prev + 1)} disabled={page >= totalPages}>Next</button>
            </div>
          </div>
        </section>
      ) : null}

      {modalOpen ? (
        <div className="adminx-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) {closeBookReview();} }}>
          <div className="adminx-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="book-review-title">
            <div className="adminx-modal__head">
              <div>
                <h3 id="book-review-title">Review manuscript</h3>
                <p>{reviewBook?.title || "Loading book review details..."}</p>
              </div>
              <button type="button" className="adminx-modal__close" onClick={closeBookReview} aria-label="Close book review">
                X
              </button>
            </div>

            {reviewLoading ? <div className="adminx-loading">Loading manuscript review...</div> : null}

            {reviewBook && !reviewLoading ? (
              <>
                <div className="adminx-modal__meta">
                  <span><strong>Status:</strong> {formatStatus(reviewBook.status)}</span>
                  <span><strong>Scan:</strong> {formatStatus(reviewBook.copyrightScanStatus)}</span>
                  <span><strong>Price:</strong> {formatCurrency(reviewBook.price, reviewBook.currency)}</span>
                  {reviewBook.creator?.displayName ? <span><strong>Creator:</strong> {reviewBook.creator.displayName}</span> : null}
                  {reviewBook.authorName ? <span><strong>Author:</strong> {reviewBook.authorName}</span> : null}
                </div>

                <p className="adminx-code-block">
                  {reviewBook.verificationNotes || reviewBook.description || "No verification notes are attached to this manuscript."}
                </p>

                <label className="adminx-modal__field">
                  <span>Approval note</span>
                  <textarea
                    className="adminx-textarea"
                    rows={3}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Add an approval note for the audit log."
                  />
                </label>

                {statusMessage ? <p className="adminx-muted">{statusMessage}</p> : null}
              </>
            ) : null}

            {reviewError ? <p className="adminx-modal__error">{reviewError}</p> : null}

            <div className="adminx-modal__actions">
              <button type="button" className="adminx-btn" onClick={closeBookReview} disabled={reviewBusy}>
                Close
              </button>
              <button type="button" className="adminx-btn" onClick={() => openManuscript()} disabled={reviewLoading || !reviewBook?.manuscriptUrl}>
                View manuscript
              </button>
              <button type="button" className="adminx-btn adminx-btn--primary" onClick={approveBook} disabled={reviewLoading || reviewBusy || !canApproveReviewBook}>
                {reviewBusy ? "Approving..." : "Approve book"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {albumReview ? (
        <div className="adminx-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishBusyKey) {setAlbumReview(null);} }}>
          <div className="adminx-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="album-review-title">
            <div className="adminx-modal__head">
              <div>
                <div className="adminx-eyebrow">Creator {albumReview.releaseType === "ep" ? "EP" : "album"}</div>
                <h3 id="album-review-title">{albumReview.title || "Untitled album"}</h3>
                <p>Listen to the submitted tracks and verify the release details before approving publication.</p>
              </div>
              <button type="button" className="adminx-modal__close" onClick={() => setAlbumReview(null)} disabled={Boolean(publishBusyKey)} aria-label="Close album review">X</button>
            </div>

            <div className="adminx-review-summary">
              <div><span>Release</span><strong>{albumReview.releaseType === "ep" ? "EP" : "Album"}</strong></div>
              <div><span>Status</span><strong>{formatStatus(albumReview.status)}</strong></div>
              <div><span>Copyright scan</span><strong>{formatStatus(albumReview.copyrightScanStatus)}</strong></div>
              <div><span>Price</span><strong>{formatCurrency(albumReview.price, albumReview.currency)}</strong></div>
            </div>

            {albumReview.description ? <p className="adminx-review-description">{albumReview.description}</p> : null}

            <div className="adminx-audio-review">
              <div>
                <strong>{Number(albumReview.totalTracks || albumReview.tracks?.length || 0)} submitted tracks</strong>
                <span>Each track must be playable before approval.</span>
              </div>
              {(albumReview.tracks || []).map((track, index) => (
                <div key={`${track.order || index}-${track.title || "track"}`}>
                  <strong>{track.order || index + 1}. {track.title || `Track ${index + 1}`}</strong>
                  {track.audioUrl ? (
                    <audio controls preload="metadata" src={resolveImage(track.previewUrl || track.audioUrl)}>
                      Your browser does not support audio playback.
                    </audio>
                  ) : <p className="adminx-modal__error">Track audio is missing.</p>}
                </div>
              ))}
            </div>

            {albumReview.verificationNotes ? (
              <p className="adminx-code-block">{albumReview.verificationNotes}</p>
            ) : null}

            <div className="adminx-modal__actions">
              <button type="button" className="adminx-btn" onClick={() => setAlbumReview(null)} disabled={Boolean(publishBusyKey)}>Cancel</button>
              <button
                type="button"
                className="adminx-btn adminx-btn--primary"
                onClick={() => publishAlbum(albumReview)}
                disabled={Boolean(publishBusyKey) || albumReview.tracksAvailable === false}
              >
                {publishBusyKey ? "Approving..." : `Approve ${albumReview.releaseType === "ep" ? "EP" : "album"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {audioReview ? (
        <div className="adminx-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishBusyKey) {setAudioReview(null);} }}>
          <div className="adminx-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="audio-review-title">
            <div className="adminx-modal__head">
              <div>
                <div className="adminx-eyebrow">{audioReview.type === "podcast" ? "Podcast episode" : "Music track"}</div>
                <h3 id="audio-review-title">{audioReview.title || "Untitled audio"}</h3>
                <p>Listen and verify the release details before approving publication.</p>
              </div>
              <button type="button" className="adminx-modal__close" onClick={() => setAudioReview(null)} disabled={Boolean(publishBusyKey)} aria-label="Close audio review">×</button>
            </div>

            <div className="adminx-review-summary">
              <div><span>Creator / artist</span><strong>{audioReview.artistName || "Not supplied"}</strong></div>
              <div><span>Status</span><strong>{formatStatus(audioReview.status)}</strong></div>
              <div><span>Copyright scan</span><strong>{formatStatus(audioReview.copyrightScanStatus)}</strong></div>
              <div><span>Price</span><strong>{formatCurrency(audioReview.price, audioReview.currency)}</strong></div>
            </div>

            {audioReview.description ? <p className="adminx-review-description">{audioReview.description}</p> : null}

            <div className="adminx-audio-review">
              <div>
                <strong>Audio preview</strong>
                <span>{audioReview.previewAvailable ? "Creator-provided preview" : "Full upload available to administrators"}</span>
              </div>
              {audioReview.audioUrl ? (
                <audio controls preload="metadata" src={resolveImage(audioReview.audioUrl)}>
                  Your browser does not support audio playback.
                </audio>
              ) : <p className="adminx-modal__error">No playable audio file is available.</p>}
            </div>

            <div className="adminx-review-checklist" aria-label="Approval checklist">
              <span>✓ Audio available</span>
              <span>✓ Metadata visible</span>
              <span>✓ Scan result visible</span>
            </div>

            <div className="adminx-modal__actions">
              <button type="button" className="adminx-btn" onClick={() => setAudioReview(null)} disabled={Boolean(publishBusyKey)}>Cancel</button>
              <button
                type="button"
                className="adminx-btn adminx-btn--primary"
                onClick={() => publishTrack(audioReview)}
                disabled={Boolean(publishBusyKey) || !audioReview.audioUrl}
              >
                {publishBusyKey ? "Approving..." : getTrackPublishLabel(audioReview)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {videoReview ? (
        <div className="adminx-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishBusyKey) {setVideoReview(null);} }}>
          <div className="adminx-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="video-review-title">
            <div className="adminx-modal__head">
              <div>
                <div className="adminx-eyebrow">Creator video</div>
                <h3 id="video-review-title">{videoReview.title || "Untitled video"}</h3>
                <p>Play the full upload and verify its release details before approving publication.</p>
              </div>
              <button type="button" className="adminx-modal__close" onClick={() => setVideoReview(null)} disabled={Boolean(publishBusyKey)} aria-label="Close video review">X</button>
            </div>

            <div className="adminx-review-summary">
              <div><span>Creator</span><strong>{videoReview.creator?.displayName || videoReview.creator?.username || "Not supplied"}</strong></div>
              <div><span>Status</span><strong>{formatStatus(videoReview.status)}</strong></div>
              <div><span>Copyright scan</span><strong>{formatStatus(videoReview.copyrightScanStatus)}</strong></div>
              <div><span>Price</span><strong>{formatCurrency(videoReview.price, videoReview.currency)}</strong></div>
            </div>

            {videoReview.description ? <p className="adminx-review-description">{videoReview.description}</p> : null}

            <div className="adminx-audio-review">
              <div>
                <strong>Video upload</strong>
                <span>{videoReview.durationSec ? `${Math.round(Number(videoReview.durationSec))} seconds` : "Duration not supplied"}</span>
              </div>
              {videoReview.videoUrl ? (
                <video
                  controls
                  preload="metadata"
                  src={resolveImage(videoReview.videoUrl)}
                  poster={resolveImage(videoReview.coverImageUrl || "") || undefined}
                  style={{ width: "100%", maxHeight: "52vh", background: "#000", borderRadius: 12 }}
                >
                  Your browser does not support video playback.
                </video>
              ) : <p className="adminx-modal__error">No playable video file is available.</p>}
            </div>

            {videoReview.verificationNotes ? (
              <p className="adminx-code-block">{videoReview.verificationNotes}</p>
            ) : null}

            <div className="adminx-review-checklist" aria-label="Video approval checklist">
              <span>Video available</span>
              <span>Metadata visible</span>
              <span>Scan result visible</span>
            </div>

            <div className="adminx-modal__actions">
              <button type="button" className="adminx-btn" onClick={() => setVideoReview(null)} disabled={Boolean(publishBusyKey)}>Cancel</button>
              <button
                type="button"
                className="adminx-btn adminx-btn--primary"
                onClick={() => publishVideo(videoReview)}
                disabled={Boolean(publishBusyKey) || !videoReview.videoUrl}
              >
                {publishBusyKey ? "Approving..." : "Approve video"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
