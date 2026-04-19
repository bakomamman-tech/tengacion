import { API_BASE, apiRequest } from "../api";

const buildSellerFormData = (payload = {}) => {
  const form = new FormData();
  [
    "fullName",
    "storeName",
    "phoneNumber",
    "bankName",
    "accountNumber",
    "accountName",
    "residentialAddress",
    "businessAddress",
    "state",
    "city",
  ].forEach((field) => {
    if (payload[field] !== undefined && payload[field] !== null) {
      form.append(field, payload[field]);
    }
  });

  form.append("acceptedTerms", String(Boolean(payload.acceptedTerms)));
  if (payload.cacCertificate instanceof File) {
    form.append("cacCertificate", payload.cacCertificate);
  }
  return form;
};

export const fetchMyMarketplaceSellerProfile = () =>
  apiRequest(`${API_BASE}/marketplace/seller/me`);

export const saveMarketplaceSellerDraft = (payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/seller/save-draft`, {
    method: "POST",
    body: buildSellerFormData(payload),
  });

export const submitMarketplaceSellerApplication = (payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/seller/submit`, {
    method: "POST",
    body: buildSellerFormData(payload),
  });

export const resubmitMarketplaceSellerApplication = (payload = {}) =>
  apiRequest(`${API_BASE}/marketplace/seller/resubmit`, {
    method: "PUT",
    body: buildSellerFormData(payload),
  });
