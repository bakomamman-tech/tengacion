const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function buildCustomerZeroReply(message) {
  const input = normalize(message);

  if (
    input.includes("price") ||
    input.includes("pricing") ||
    input.includes("cost") ||
    input.includes("how much") ||
    input.includes("quote")
  ) {
    return {
      reply:
        "Tengacion prices projects according to scope, complexity, integrations, and delivery requirements. Tell me what you want to build and I can help structure the requirements for a quote.",
      actions: [],
    };
  }

  if (
    input.includes("website") ||
    input.includes("web app") ||
    input.includes("ecommerce") ||
    input.includes("e-commerce")
  ) {
    return {
      reply:
        "Yes. Tengacion works on web applications and digital platforms. Tell me the type of website or web product you need, the main features, and your target users.",
      actions: [],
    };
  }

  if (
    input.includes("mobile") ||
    input.includes("android") ||
    input.includes("ios") ||
    input.includes("app")
  ) {
    return {
      reply:
        "Tengacion works on software products that can include mobile experiences. Tell me what the app should do and who will use it, and I can help turn that into a clearer project brief.",
      actions: [],
    };
  }

  if (
    input.includes("ai") ||
    input.includes("artificial intelligence") ||
    input.includes("agent") ||
    input.includes("automation")
  ) {
    return {
      reply:
        "Tengacion develops AI-enabled software and automation solutions. If you describe the business problem you want AI to solve, I can help identify the right starting point.",
      actions: [],
    };
  }

  if (
    input.includes("contact") ||
    input.includes("talk to") ||
    input.includes("speak to") ||
    input.includes("human") ||
    input.includes("meeting") ||
    input.includes("book")
  ) {
    return {
      reply:
        "I can help you prepare to speak with the Tengacion team. Tell me briefly what you need help with. Lead capture and automatic booking are being added to this TengaAgent pilot.",
      actions: [],
    };
  }

  if (
    input.includes("hello") ||
    input.includes("hi") ||
    input.includes("hey")
  ) {
    return {
      reply:
        "Hello! I'm TengaAgent, Tengacion's AI receptionist. I can help with questions about software development, websites, mobile products, AI solutions, or starting a new project.",
      actions: [],
    };
  }

  return {
    reply:
      "I can help you understand Tengacion's software and AI services or help you start describing a project. What would you like to build or improve?",
    actions: [],
  };
}

async function respondToCustomerZero({
  message,
}) {
  return buildCustomerZeroReply(message);
}

module.exports = {
  buildCustomerZeroReply,
  respondToCustomerZero,
};
