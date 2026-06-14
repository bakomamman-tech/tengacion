import { useEffect, useMemo, useState } from "react";

import {
  MARKETPLACE_CATEGORY_SUGGESTIONS,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_DELIVERY_OPTIONS,
} from "../../services/marketplaceService";
import { UPLOAD_LIMITS } from "../../config/uploadLimits";

const emptyState = {
  title: "",
  description: "",
  category: "",
  price: "",
  stock: "",
  condition: "new",
  state: "",
  city: "",
  deliveryOptions: ["pickup"],
  deliveryNotes: "",
  images: [],
  video: null,
};

export default function ProductForm({
  initialProduct = null,
  submitting = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(emptyState);
  const [existingImages, setExistingImages] = useState([]);
  const [existingVideo, setExistingVideo] = useState(null);
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    if (!initialProduct) {
      setForm(emptyState);
      setExistingImages([]);
      setExistingVideo(null);
      setMediaError("");
      return;
    }

    setForm({
      title: initialProduct.title || "",
      description: initialProduct.description || "",
      category: initialProduct.category || "",
      price: initialProduct.price || "",
      stock: initialProduct.stock || "",
      condition: initialProduct.condition || "new",
      state: initialProduct.state || "",
      city: initialProduct.city || "",
      deliveryOptions: Array.isArray(initialProduct.deliveryOptions)
        ? initialProduct.deliveryOptions
        : ["pickup"],
      deliveryNotes: initialProduct.deliveryNotes || "",
      images: [],
      video: null,
    });
    setExistingImages(Array.isArray(initialProduct.images) ? initialProduct.images : []);
    setExistingVideo(initialProduct.video || null);
    setMediaError("");
  }, [initialProduct]);

  const previewFiles = useMemo(
    () =>
      (Array.isArray(form.images) ? form.images : []).map((file) => ({
        id: `${file.name}-${file.size}`,
        url: URL.createObjectURL(file),
        name: file.name,
      })),
    [form.images]
  );

  useEffect(
    () => () => {
      previewFiles.forEach((file) => URL.revokeObjectURL(file.url));
    },
    [previewFiles]
  );

  const videoPreviewUrl = useMemo(
    () => (form.video ? URL.createObjectURL(form.video) : ""),
    [form.video]
  );

  useEffect(
    () => () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    },
    [videoPreviewUrl]
  );

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleDeliveryOption = (value) => {
    setForm((current) => {
      const set = new Set(current.deliveryOptions || []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      return {
        ...current,
        deliveryOptions: Array.from(set),
      };
    });
  };

  const selectProductVideo = (file) => {
    if (!file) {
      updateField("video", null);
      setMediaError("");
      return;
    }

    const mimeType = String(file.type || "").toLowerCase();
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)) {
      updateField("video", null);
      setMediaError("Product videos must be MP4, MOV, or WebM.");
      return;
    }
    if ((Number(file.size) || 0) > UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES) {
      updateField("video", null);
      setMediaError("Marketplace product videos must be 30MB or smaller.");
      return;
    }

    updateField("video", file);
    setExistingVideo(null);
    setMediaError("");
  };

  return (
    <section className="marketplace-form-card">
      <div className="marketplace-panel__head">
        <div>
          <h3>{initialProduct ? "Edit listing" : "Add a marketplace listing"}</h3>
          <p className="marketplace-muted">
            Upload clean product photos, set your location, and remember the NGN 300
            service charge stays included inside the listed price.
          </p>
        </div>
      </div>

      <div className="marketplace-form-grid">
        <div className="marketplace-form-field marketplace-form-field--full">
          <label htmlFor="marketplace-product-title">Product title</label>
          <input
            id="marketplace-product-title"
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Wireless earbuds with charging case"
          />
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-category">Category</label>
          <input
            id="marketplace-product-category"
            list="marketplace-category-suggestions"
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            placeholder="Electronics"
          />
          <datalist id="marketplace-category-suggestions">
            {MARKETPLACE_CATEGORY_SUGGESTIONS.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-condition">Condition</label>
          <select
            id="marketplace-product-condition"
            value={form.condition}
            onChange={(event) => updateField("condition", event.target.value)}
          >
            {MARKETPLACE_CONDITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-price">Price</label>
          <input
            id="marketplace-product-price"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            placeholder="5000"
            inputMode="numeric"
          />
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-stock">Stock</label>
          <input
            id="marketplace-product-stock"
            value={form.stock}
            onChange={(event) => updateField("stock", event.target.value)}
            placeholder="12"
            inputMode="numeric"
          />
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-state">State</label>
          <input
            id="marketplace-product-state"
            value={form.state}
            onChange={(event) => updateField("state", event.target.value)}
            placeholder="Lagos"
          />
        </div>

        <div className="marketplace-form-field">
          <label htmlFor="marketplace-product-city">City</label>
          <input
            id="marketplace-product-city"
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Ikeja"
          />
        </div>

        <div className="marketplace-form-field marketplace-form-field--full">
          <label htmlFor="marketplace-product-description">Description</label>
          <textarea
            id="marketplace-product-description"
            rows={5}
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Describe quality, usage history, and what buyers should know."
          />
        </div>

        <div className="marketplace-form-field marketplace-form-field--full">
          <label>Delivery options</label>
          <div className="marketplace-checkbox-row">
            {MARKETPLACE_DELIVERY_OPTIONS.map((option) => (
              <label key={option.value} className="marketplace-checkbox">
                <input
                  type="checkbox"
                  checked={(form.deliveryOptions || []).includes(option.value)}
                  onChange={() => toggleDeliveryOption(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="marketplace-form-field marketplace-form-field--full">
          <label htmlFor="marketplace-product-delivery-notes">Delivery notes</label>
          <textarea
            id="marketplace-product-delivery-notes"
            rows={3}
            value={form.deliveryNotes}
            onChange={(event) => updateField("deliveryNotes", event.target.value)}
            placeholder="Pickup landmark, local delivery timing, or nationwide dispatch details."
          />
        </div>

        <div className="marketplace-form-field marketplace-form-field--full">
          <label htmlFor="marketplace-product-images">Product images</label>
          <input
            id="marketplace-product-images"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              const oversized = files.find(
                (file) => (Number(file.size) || 0) > UPLOAD_LIMITS.IMAGE_BYTES
              );
              if (oversized) {
                updateField("images", []);
                setMediaError("Marketplace product images must be 10MB or smaller.");
                event.target.value = "";
                return;
              }
              updateField("images", files);
              setMediaError("");
            }}
          />
          {existingImages.length ? (
            <div className="marketplace-image-chip-row">
              {existingImages.map((image) => (
                <div key={image.assetId || image.publicId || image.url} className="marketplace-image-chip">
                  <img src={image.url || image.secureUrl} alt="" />
                  <button
                    type="button"
                    onClick={() =>
                      setExistingImages((current) =>
                        current.filter((entry) => entry !== image)
                      )
                    }
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {previewFiles.length ? (
            <div className="marketplace-image-chip-row">
              {previewFiles.map((image) => (
                <div key={image.id} className="marketplace-image-chip">
                  <img src={image.url} alt={image.name} />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="marketplace-form-field marketplace-form-field--full">
          <label htmlFor="marketplace-product-video">Product video (optional)</label>
          <input
            id="marketplace-product-video"
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={(event) => {
              selectProductVideo(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
          <p className="marketplace-field-hint">MP4, MOV, or WebM. Maximum size: 30MB.</p>
          {mediaError ? <p className="marketplace-field-error">{mediaError}</p> : null}
          {videoPreviewUrl || existingVideo ? (
            <div className="marketplace-video-preview">
              <video
                controls
                src={videoPreviewUrl || existingVideo?.url || existingVideo?.secureUrl}
              />
              <button
                type="button"
                className="marketplace-ghost-btn"
                onClick={() => {
                  updateField("video", null);
                  setExistingVideo(null);
                  setMediaError("");
                }}
              >
                Remove video
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="marketplace-form-actions">
        <button
          type="button"
          className="marketplace-primary-btn"
          disabled={submitting || Boolean(mediaError)}
          onClick={() =>
            onSubmit?.({
              ...form,
              existingImages,
              existingVideo,
              removeVideo: Boolean(initialProduct?.video && !existingVideo && !form.video),
            })
          }
        >
          <span className="marketplace-btn__icon" aria-hidden="true">
            {initialProduct ? ">" : "+"}
          </span>
          {submitting ? "Saving..." : initialProduct ? "Save changes" : "Create listing"}
        </button>
        {onCancel ? (
          <button type="button" className="marketplace-ghost-btn" onClick={onCancel}>
            <span className="marketplace-btn__icon" aria-hidden="true">
              x
            </span>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
