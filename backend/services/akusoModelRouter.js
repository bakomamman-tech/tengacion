const { config } = require("../config/env");
const { AKUSO_MODES } = require("./akusoClassifierService");

const selectAkusoModel = ({ policyResult = {}, routePurpose = "chat" } = {}) => {
  if (!config.akuso?.enabled || !config.akuso?.hasOpenAI || !policyResult?.shouldCallModel) {
    return {
      useModel: false,
      model: "",
      task: policyResult?.shouldCallModel ? policyResult.taskType || "local_fallback" : "local_fallback",
      reason: "Akuso is not ready for OpenAI-backed generation in this environment.",
    };
  }

  if (routePurpose === "hints" || policyResult.categoryBucket === "APP_GUIDANCE") {
    return {
      useModel: true,
      model: config.akuso.models.fast,
      task: "app_guidance",
      reason: "Fast model selected for concise app guidance and hints.",
    };
  }

  if (policyResult.mode === AKUSO_MODES.CREATOR_WRITING) {
    return {
      useModel: true,
      model: config.akuso.models.writing,
      task: "creator_writing",
      reason: "Writing model selected for creator-facing drafting support.",
    };
  }

  if (policyResult.taskType === "software_engineering") {
    return {
      useModel: true,
      model: config.akuso.models.reasoning,
      task: "software_engineering",
      reason: "Reasoning model selected for code generation and implementation planning.",
    };
  }

  if (policyResult.taskType === "reasoning") {
    return {
      useModel: true,
      model: config.akuso.models.reasoning,
      task: "reasoning",
      reason: "Reasoning model selected for step-by-step technical explanation.",
    };
  }

  return {
    useModel: true,
    model: config.akuso.models.primary,
    task: "chat",
    reason: "Primary model selected for default Akuso conversations.",
  };
};

module.exports = {
  selectAkusoModel,
};
