import { API_BASE, apiRequest } from "../api";

export const MARKETPLACE_DELIVERY_OPTIONS = [
  { value: "pickup", label: "Pickup" },
  { value: "local_delivery", label: "Local delivery" },
  { value: "nationwide_delivery", label: "Nationwide delivery" },
];

export const MARKETPLACE_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

export const MARKETPLACE_CATEGORY_SUGGESTIONS = [
  "Fashion",
  "Beauty",
  "Electronics",
  "Home",
  "Food",
  "Books",
  "Accessories",
  "Furniture",
  "Phones",
  "Appliances",
];

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  return `${path}${query.toString() ? `?${query.toString()}` : ""}`;
};

const appendFormValue = (form, key, value) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  form.append(key, value);
};

const appendFiles = (form, fieldName, files = []) => {
  (Array.isArray(files) ? files : []).forEach((file) => {
    if (file instanceof File) {
      form.append(fieldName, file);
    }
  });
};

const buildProductFormData = (payload = {}) => {
  const form = new FormData();
  appendFormValue(form, "title", payload.title);
  appendFormValue(form, "description", payload.description);
  appendFormValue(form, "category", payload.category);
  appendFormValue(form, "price", payload.price);
  appendFormValue(form, "stock", payload.stock);
  appendFormValue(form, "condition", payload.condition);
  appendFormValue(form, "state", payload.state);
  appendFormValue(form, "city", payload.city);
  appendFormValue(form, "deliveryNotes", payload.deliveryNotes);
  if (Array.isArray(payload.deliveryOptions)) {
    form.append("deliveryOptions", JSON.stringify(payload.deliveryOptions));
  }
  if (Array.isArray(payload.existingImages)) {
    form.append("existingImages", JSON.stringify(payload.existingImages));
  }
  if (payload.isPublished !== undefined) {
    form.append("isPublished", String(Boolean(payload.isPublished)));
  }
  appendFiles(form, "images", payload.images);
  return form;
};

export const fetchMarketplaceHome = (params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/products`, params));

export const fetchMarketplaceProductDetail = (idOrSlug) =>
  apiRequest(`${API_BASE}/marketplace/products/${encodeURIComponent(idOrSlug || "")}`);

export const fetchMarketplaceStorefront = (idOrSlug) =>
  apiRequest(`${API_BASE}/marketplace/store/${encodeURIComponent(idOrSlug || "")}`);

export const fetchMarketplaceStoreProducts = (storeId, params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/store/${encodeURIComponent(storeId || "")}/products`, params));

export const fetchMyMarketplaceProducts = (params = {}) =>
  apiRequest(withQuery(`${API_BASE}/marketplace/seller/products`, params));

export const createMarketplaceListing = (payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/products`, {
    method: "POST",
    body: buildProductFormData(payload),
  });

export const updateMarketplaceListing = (productId, payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/products/${encodeURIComponent(productId || "")}`, {
    method: "PUT",
    body: buildProductFormData(payload),
  });

export const publishMarketplaceListing = (productId) =>
  apiRequest(`${API_BASE}/marketplace/products/${encodeURIComponent(productId || "")}/publish`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const unpublishMarketplaceListing = (productId) =>
  apiRequest(`${API_BASE}/marketplace/products/${encodeURIComponent(productId || "")}/unpublish`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const deleteMarketplaceListing = (productId) =>
  apiRequest(`${API_BASE}/marketplace/products/${encodeURIComponent(productId || "")}`, {
    method: "DELETE",
  });
