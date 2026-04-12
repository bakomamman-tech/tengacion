const SAFE_ROUTE_PATTERNS = [
  /^\/home\/?$/,
  /^\/messages(?:[/?#].*)?$/,
  /^\/notifications(?:[/?#].*)?$/,
  /^\/search(?:[/?#].*)?$/,
  /^\/find-creators(?:[/?#].*)?$/,
  /^\/purchases(?:[/?#].*)?$/,
  /^\/dashboard(?:[/?#].*)?$/,
  /^\/settings(?:[/?#].*)?$/,
  /^\/creator(?:[/?#].*)?$/,
  /^\/profile\/[^/?#]+(?:[/?#].*)?$/,
  /^\/posts\/[^/?#]+(?:[/?#].*)?$/,
  /^\/tracks\/[^/?#]+(?:[/?#].*)?$/,
  /^\/books\/[^/?#]+(?:[/?#].*)?$/,
  /^\/albums\/[^/?#]+(?:[/?#].*)?$/,
  /^\/news(?:[/?#].*)?$/,
  /^\/friends\/?$/,
  /^\/groups\/?$/,
  /^\/rooms\/?$/,
  /^\/saved\/?$/,
  /^\/memories\/?$/,
  /^\/events\/?$/,
  /^\/birthdays\/?$/,
  /^\/calculator\/?$/,
  /^\/ads-manager\/?$/,
  /^\/live(?:[/?#].*)?$/,
  /^\/admin(?:[/?#].*)?$/,
];

const isSafeAssistantRoute = (target = "") => {
  const route = String(target || "").trim();
  if (!route.startsWith("/")) {
    return false;
  }

  if (route.includes("://") || route.includes("\\") || route.includes("..")) {
    return false;
  }

  return SAFE_ROUTE_PATTERNS.some((pattern) => pattern.test(route));
};

const normalizeActionState = (state) =>
  state && typeof state === "object" && !Array.isArray(state) ? state : {};

const executeAssistantActions = (actions = [], handlers = {}) => {
  const outcomes = [];
  const navigate = typeof handlers.navigate === "function" ? handlers.navigate : null;
  const openTab = typeof handlers.openTab === "function" ? handlers.openTab : null;
  const openModal = typeof handlers.openModal === "function" ? handlers.openModal : null;
  const prefillForm = typeof handlers.prefillForm === "function" ? handlers.prefillForm : null;

  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action || typeof action !== "object") {
      continue;
    }

    const type = String(action.type || "").trim();
    const target = String(action.target || "").trim();
    const state = normalizeActionState(action.state);

    if (type === "navigate") {
      if (isSafeAssistantRoute(target) && navigate) {
        navigate(target, state, action);
        outcomes.push({ action, executed: true });
      } else {
        outcomes.push({ action, executed: false, reason: "unsafe_route" });
      }
      continue;
    }

    if (type === "open_tab") {
      if (isSafeAssistantRoute(target) && openTab) {
        openTab(target, state, action);
        outcomes.push({ action, executed: true });
      } else {
        outcomes.push({ action, executed: false, reason: "unsafe_route" });
      }
      continue;
    }

    if (type === "open_modal") {
      if (openModal) {
        openModal(target, state, action);
      }
      outcomes.push({ action, executed: Boolean(openModal), reason: "modal_delegated" });
      continue;
    }

    if (type === "prefill_form") {
      if (prefillForm) {
        prefillForm(target, state, action);
      }
      outcomes.push({ action, executed: Boolean(prefillForm), reason: "prefill_delegated" });
      continue;
    }

    outcomes.push({ action, executed: false, reason: "unsupported_action" });
  }

  return outcomes;
};

export { isSafeAssistantRoute, executeAssistantActions };
