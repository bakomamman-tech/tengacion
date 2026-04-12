const { draftPostCaptionTool, explainFeatureTool } = require("./drafting");
const { navigateToTool, openCreatorOnboardingTool, openUploadPageTool } = require("./navigation");
const { searchCreatorsTool, searchContentTool } = require("./search");
const {
  getNotificationsSummaryTool,
  getPurchasesSummaryTool,
  getQuickLinksTool,
} = require("./summaries");

const tools = [
  navigateToTool,
  searchCreatorsTool,
  searchContentTool,
  getNotificationsSummaryTool,
  openCreatorOnboardingTool,
  openUploadPageTool,
  getPurchasesSummaryTool,
  getQuickLinksTool,
  draftPostCaptionTool,
  explainFeatureTool,
];

const toolDefinitions = tools.map(({ name, description, parameters }) => ({
  type: "function",
  function: {
    name,
    description,
    parameters,
  },
}));

const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

const executeTool = async (toolName, rawArgs = {}, context = {}) => {
  const tool = toolByName.get(toolName);
  if (!tool) {
    const error = new Error(`Unknown assistant tool: ${toolName}`);
    error.code = "UNKNOWN_TOOL";
    error.statusCode = 400;
    throw error;
  }

  const parsedArgs = tool.inputSchema.safeParse(rawArgs || {});
  if (!parsedArgs.success) {
    const error = new Error(parsedArgs.error.issues[0]?.message || "Invalid assistant tool arguments");
    error.code = "INVALID_TOOL_ARGS";
    error.statusCode = 400;
    throw error;
  }

  return tool.handler(parsedArgs.data, context);
};

module.exports = {
  executeTool,
  toolByName,
  toolDefinitions,
};
