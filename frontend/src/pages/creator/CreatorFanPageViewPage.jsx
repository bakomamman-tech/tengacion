import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  createCheckout,
  getDownloadUrl,
  getPublicCreatorProfile,
  initPayment,
  toggleFollowCreator,
} from "../../api";
import PublicNav from "../../components/PublicNav";
import CreatorFanPagePreview from "../../components/creator/CreatorFanPagePreview";
import {
  buildCreatorFanPageDataFromPublicPayload,
  resolveCreatorFanPageTabKey,
} from "../../components/creator/creatorFanPageData";
import { loadCreatorWorkspaceBundle } from "../../components/creator/creatorWorkspaceData";
import {
  buildPaystackCallbackUrl,
  normalizePurchaseType,
} from "../../utils/purchaseUx";

import "./creator-fan-page-view.css";

const resolveInitialPublicTab = (pathname = "") => {
  const normalized = String(pathname || "").toLowerCase();
  if (normalized.endsWith("/books")) {
    return "books";
  }
  if (normalized.endsWith("/podcasts")) {
    return "podcasts";
  }
  if (normalized.endsWith("/store")) {
    return "store";
  }
  if (normalized.endsWith("/posts")) {
    return "posts";
  }
  if (normalized.endsWith("/videos")) {
    return "videos";
  }
  return "music";
};

export default function CreatorFanPageViewPage() {
  const { creatorId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicRequest = Boolean(String(creatorId || "").trim());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [publicPayload, setPublicPayload] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [purchaseBusyKey, setPurchaseBusyKey] = useState("");
  const initialTab = useMemo(
    () => resolveCreatorFanPageTabKey(resolveInitialPublicTab(location.pathname)),
    [location.pathname]
  );

  const loadPage = useCallback(async () => {
    setLoading(true);

    try {
      if (isPublicRequest) {
        const nextPayload = await getPublicCreatorProfile(creatorId);
        setPublicPayload(nextPayload || null);
        setCreatorProfile(null);
        setDashboard(null);
      } else {
        const nextWorkspace = await loadCreatorWorkspaceBundle();
        setCreatorProfile(nextWorkspace.creatorProfile);
        setDashboard(nextWorkspace.dashboard);
        setPublicPayload(null);
      }
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to load the fan page.");
    } finally {
      setLoading(false);
    }
  }, [creatorId, isPublicRequest]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleFollow = useCallback(async () => {
    const publicCreatorId = publicPayload?.creator?.id;
    if (!publicCreatorId) {
      return;
    }
    try {
      setFollowBusy(true);
      const response = await toggleFollowCreator(publicCreatorId);
      setPublicPayload((current) =>
        current
          ? {
              ...current,
              viewer: {
                ...(current.viewer || {}),
                isFollowing: Boolean(response?.following),
              },
              creator: {
                ...(current.creator || {}),
                followersCount: Number(response?.followersCount ?? current.creator?.followersCount ?? 0),
              },
              stats: {
                ...(current.stats || {}),
                followersCount: Number(response?.followersCount ?? current.stats?.followersCount ?? 0),
              },
            }
          : current
      );
    } catch (err) {
      toast.error(err?.message || "Could not follow this creator right now.");
    } finally {
      setFollowBusy(false);
    }
  }, [publicPayload?.creator?.id]);

  const handleSubscribe = useCallback(() => {
    const publicCreatorId = publicPayload?.creator?.id;
    if (!publicCreatorId) {
      return;
    }
    navigate(publicPayload?.creator?.subscribePath || `/creators/${publicCreatorId}/subscribe`);
  }, [navigate, publicPayload?.creator?.id, publicPayload?.creator?.subscribePath]);

  const handleMessage = useCallback(() => {
    navigate("/messages", {
      state: {
        recipientId: publicPayload?.creator?.userId || "",
        recipientName: publicPayload?.creator?.displayName || "",
      },
    });
  }, [navigate, publicPayload?.creator?.displayName, publicPayload?.creator?.userId]);

  const handleComment = useCallback(
    (item = {}) => {
      const path = item?.publicPath || item?.detailPath || item?.route || "";
      if (path) {
        navigate(path);
      }
    },
    [navigate]
  );

  const handlePurchase = useCallback(
    async (item = {}) => {
      const itemId = String(item?.id || item?._id || "").trim();
      if (!itemId) {
        return;
      }

      const itemType = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
      const itemKey = `${itemType || "item"}:${itemId}`;

      if (itemType === "product") {
        navigate(item.publicPath || item.detailPath || item.route || "/marketplace");
        return;
      }

      const returnUrl = buildPaystackCallbackUrl({
        returnTo: `${location.pathname}${location.search}`,
        itemType,
        itemId,
      });

      try {
        setPurchaseBusyKey(itemKey);

        if (["track", "book", "podcast"].includes(itemType)) {
          const payment = await initPayment({
            itemType,
            itemId,
            returnUrl,
          });
          if (!payment?.authorization_url) {
            throw new Error("Payment link is missing");
          }
          window.location.assign(payment.authorization_url);
          return;
        }

        const checkout = await createCheckout({
          itemType,
          itemId,
          currencyMode: "NG",
        });
        if (!checkout?.checkoutUrl) {
          throw new Error("Checkout unavailable");
        }
        window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err?.message || "Could not start checkout.");
      } finally {
        setPurchaseBusyKey("");
      }
    },
    [location.pathname, location.search, navigate]
  );

  const handleDownload = useCallback(
    async (item = {}) => {
      const itemId = String(item?.id || item?._id || "").trim();
      const itemType = normalizePurchaseType(item.itemType || item.productType || item.mediaType);
      if (!itemId || !itemType) {
        return;
      }

      try {
        if (item?.downloadUrl) {
          window.open(item.downloadUrl, "_blank", "noopener,noreferrer");
          return;
        }
        const payload = await getDownloadUrl(itemType, itemId);
        if (!payload?.downloadUrl) {
          throw new Error("Download unavailable");
        }
        window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err?.message || "Could not prepare download.");
      }
    },
    []
  );

  const publicPreviewData = useMemo(
    () => (publicPayload ? buildCreatorFanPageDataFromPublicPayload(publicPayload) : null),
    [publicPayload]
  );

  if (loading) {
    return (
      <div className="creator-fan-page-shell">
        {isPublicRequest ? <PublicNav theme="dark" /> : null}
        <div className="creator-fan-page-status">
          <div className="creator-fan-page-status__card">
            <h2>{isPublicRequest ? "Loading Creator Fan Page" : "Loading Fan Page View"}</h2>
            <p>
              {isPublicRequest
                ? "Opening the public fan experience for this creator."
                : "Building the public fan-facing preview for your creator page."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || (isPublicRequest ? !publicPreviewData : (!creatorProfile || !dashboard))) {
    return (
      <div className="creator-fan-page-shell">
        {isPublicRequest ? <PublicNav theme="dark" /> : null}
        <div className="creator-fan-page-status">
          <div className="creator-fan-page-status__card">
            <h2>{isPublicRequest ? "Creator fan page unavailable" : "Fan Page View unavailable"}</h2>
            <p>{error || "We could not load the public fan page right now."}</p>
            <button
              type="button"
              className="creator-fan-page-status__retry"
              onClick={loadPage}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="creator-fan-page-shell">
      {isPublicRequest ? <PublicNav theme="dark" /> : null}
      <CreatorFanPagePreview
        creatorProfile={creatorProfile}
        dashboard={dashboard}
        previewData={publicPreviewData || undefined}
        dashboardPath="/creator/dashboard"
        mode={isPublicRequest ? "public" : "workspace"}
        initialTab={isPublicRequest ? initialTab : "music"}
        followBusy={followBusy}
        purchaseBusyKey={purchaseBusyKey}
        onFollow={handleFollow}
        onSupport={handleSubscribe}
        onSubscribe={handleSubscribe}
        onMessage={handleMessage}
        onComment={handleComment}
        onPurchase={handlePurchase}
        onDownload={handleDownload}
      />
    </div>
  );
}
