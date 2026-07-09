export const getWithdrawalProviderIssue = (error = {}) => {
  const details = error?.details || error?.payload?.details || error?.providerIssue || {};
  const code = String(details.code || error?.code || error?.providerIssue?.code || "").trim();
  const status = String(error?.withdrawal?.status || "").trim();
  const message = String(
    error?.message ||
    details.providerMessage ||
    details.message ||
    error?.providerIssue?.message ||
    error?.withdrawal?.failureReason ||
    ""
  ).trim();

  if (
    code === "paystack_business_restriction"
    || status === "provider_setup_required"
    || /paystack business activation/i.test(message)
    || /paystack business transfer activation/i.test(message)
    || /third party payouts?.*starter business/i.test(message)
  ) {
    return {
      code: "paystack_business_restriction",
      title: "Paystack business transfer activation required",
      message:
        message
        || "Tengacion payouts are waiting for Paystack business transfer activation.",
      action:
        details.action
        || error?.providerIssue?.action
        || "Tengacion finance will retry this queued withdrawal after Paystack activates third-party transfers.",
    };
  }

  return null;
};
