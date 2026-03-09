export const REPORT_REASON_OPTIONS = [
  { value: "spam", label: "Spam" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violence" },
  { value: "harassment", label: "Harassment" },
  { value: "misinformation", label: "Misinformation" },
  { value: "nudity", label: "Nudity" },
  { value: "other", label: "Other" },
];

export function createReportDialogConfig(targetLabel, defaultValue = "spam") {
  return {
    title: `Report ${targetLabel}`,
    description:
      "Help the moderation team review this faster by choosing the closest reason.",
    label: "Reason",
    hint: "You can pick a quick option or enter your own reason.",
    confirmLabel: "Submit report",
    cancelLabel: "Cancel",
    confirmVariant: "destructive",
    required: true,
    defaultValue,
    placeholder: "Enter a reason",
    options: REPORT_REASON_OPTIONS,
  };
}
