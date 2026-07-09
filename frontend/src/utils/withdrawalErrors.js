export const getWithdrawalProviderIssue = (error = {}) => {
  const details = error?.details || error?.payload?.details || {};
  const code = String(details.code || error?.code || "").trim();
  const message = String(error?.message || details.providerMessage || "").trim();

  if (
    code === "paystack_business_restriction"
    || /paystack business activation/i.test(message)
    || /third party payouts?.*starter business/i.test(message)
  ) {
    return {
      code: "paystack_business_restriction",
      title: "Paystack payout activation required",
      message:
        message
        || "Tengacion payouts need Paystack business activation before automatic withdrawals can run.",
      action:
        details.action
        || "Tengacion admin must activate third-party Paystack transfers before retrying.",
    };
  }

  return null;
};
