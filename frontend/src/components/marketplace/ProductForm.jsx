import { useEffect, useMemo, useState } from "react";

import {
  MARKETPLACE_CATEGORY_SUGGESTIONS,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_DELIVERY_OPTIONS,
} from "../../services/marketplaceService";

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
};

export default function ProductForm({
  initialProduct = null,
  submitting = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(emptyState);
  const [existingImages, setExistingImages] = useState([]);

  useEffect(() => {
    if (!initialProduct) {
      setForm(emptyState);
      setExistingImages([]);
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
    });
    setExistingImages(Array.isArray(initialProduct.images) ? initialProduct.images : []);
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
            onChange={(event) => updateField("images", Array.from(event.target.files || []))}
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
      </div>

      <div className="marketplace-form-actions">
        <button
          type="button"
          className="marketplace-primary-btn"
          disabled={submitting}
          onClick={() =>
            onSubmit?.({
              ...form,
              existingImages,
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
