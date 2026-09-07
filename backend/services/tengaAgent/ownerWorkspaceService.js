const Organization =
  require(
    "../../models/tengaAgent/Organization"
  );

const Agent =
  require(
    "../../models/tengaAgent/Agent"
  );

const KnowledgeSource =
  require(
    "../../models/tengaAgent/KnowledgeSource"
  );

const {
  syncKnowledgeSource,
} = require(
  "./knowledgeIngestionService"
);

const OWNER_AGENT_KEY =
  "receptionist";

const OWNER_KNOWLEDGE_TYPES =
  new Set([
    "manual",
    "faq",
    "service",
    "hours",
  ]);

const cleanText = (
  value,
  max
) =>
  String(value || "")
    .trim()
    .slice(0, max);

const slugify = (
  value
) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(0, 75) ||
  "business";

const buildOwnerSlug = ({
  name,
  userId,
}) => {
  const suffix =
    String(userId || "")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .slice(-8)
      .toLowerCase();

  return `${slugify(name)}-${suffix || "owner"}`;
};

const findOwnerWorkspace =
  async (userId) => {
    if (!userId) {
      return null;
    }

    const organization =
      await Organization.findOne({
        ownerUser:
          userId,

        status: {
          $ne: "closed",
        },
      }).sort({
        createdAt: 1,
      });

    if (!organization) {
      return null;
    }

    const agent =
      await Agent.findOne({
        organizationId:
          organization._id,

        key:
          OWNER_AGENT_KEY,
      });

    return {
      organization,
      agent,
    };
  };

const ensureOwnerAgent =
  async ({
    organization,
  }) =>
    Agent.findOneAndUpdate(
      {
        organizationId:
          organization._id,

        key:
          OWNER_AGENT_KEY,
      },
      {
        $setOnInsert: {
          organizationId:
            organization._id,

          key:
            OWNER_AGENT_KEY,

          name:
            "TengaAgent",

          role:
            "AI Receptionist",

          greeting:
            "Hi! How can I help you today?",

          tone:
            "friendly-professional",

          languages: [
            "English",
          ],

          enabledTools: [],

          isPublicDemo:
            false,

          status:
            "draft",

          systemInstructions:
            "Represent this business accurately. Use only approved business knowledge. Never invent prices, policies, credentials, guarantees, or capabilities.",
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert:
          true,
      }
    );

const createOrUpdateOwnerWorkspace =
  async ({
    userId,
    name,
    website,
    industry,
    countryCode,
    timezone,
  }) => {
    if (!userId) {
      throw new Error(
        "Authenticated user is required."
      );
    }

    let organization =
      await Organization.findOne({
        ownerUser:
          userId,

        status: {
          $ne: "closed",
        },
      }).sort({
        createdAt: 1,
      });

    if (!organization) {
      const cleanName =
        cleanText(
          name,
          180
        );

      if (!cleanName) {
        throw new Error(
          "Business name is required."
        );
      }

      const normalizedCountry =
        cleanText(
          countryCode || "NG",
          2
        ).toUpperCase();

      if (
        !/^[A-Z]{2}$/.test(
          normalizedCountry
        )
      ) {
        throw new Error(
          "Country code must be a 2-letter ISO-style code."
        );
      }

      organization =
        await Organization.create({
          name:
            cleanName,

          slug:
            buildOwnerSlug({
              name:
                cleanName,
              userId,
            }),

          website:
            cleanText(
              website,
              500
            ),

          industry:
            cleanText(
              industry,
              120
            ),

          countryCode:
            normalizedCountry,

          timezone:
            cleanText(
              timezone ||
                "Africa/Lagos",
              100
            ),

          ownerUser:
            userId,

          plan:
            "starter",

          status:
            "pilot",
        });
    } else {
      if (
        typeof name ===
          "string" &&
        name.trim()
      ) {
        organization.name =
          cleanText(
            name,
            180
          );
      }

      if (
        typeof website ===
        "string"
      ) {
        organization.website =
          cleanText(
            website,
            500
          );
      }

      if (
        typeof industry ===
        "string"
      ) {
        organization.industry =
          cleanText(
            industry,
            120
          );
      }

      if (
        typeof countryCode ===
          "string" &&
        countryCode.trim()
      ) {
        const normalizedCountry =
          cleanText(
            countryCode,
            2
          ).toUpperCase();

        if (
          !/^[A-Z]{2}$/.test(
            normalizedCountry
          )
        ) {
          throw new Error(
            "Country code must be a 2-letter ISO-style code."
          );
        }

        organization.countryCode =
          normalizedCountry;
      }

      if (
        typeof timezone ===
          "string" &&
        timezone.trim()
      ) {
        organization.timezone =
          cleanText(
            timezone,
            100
          );
      }

      await organization.save();
    }

    const agent =
      await ensureOwnerAgent({
        organization,
      });

    return {
      organization,
      agent,
    };
  };

const listOwnerKnowledge =
  async ({
    userId,
  }) => {
    const workspace =
      await findOwnerWorkspace(
        userId
      );

    if (!workspace) {
      return null;
    }

    const sources =
      await KnowledgeSource.find({
        organizationId:
          workspace
            .organization
            ._id,

        status: {
          $ne:
            "archived",
        },
      })
        .sort({
          updatedAt: -1,
        })
        .lean();

    return {
      ...workspace,
      sources,
    };
  };

const syncOwnerKnowledge =
  async ({
    userId,
    type,
    title,
    text,
    metadata = {},
    embedder,
  }) => {
    const workspace =
      await findOwnerWorkspace(
        userId
      );

    if (!workspace) {
      throw new Error(
        "Create your TengaAgent workspace first."
      );
    }

    const normalizedType =
      cleanText(
        type || "manual",
        40
      ).toLowerCase();

    if (
      !OWNER_KNOWLEDGE_TYPES.has(
        normalizedType
      )
    ) {
      throw new Error(
        "Unsupported owner knowledge type."
      );
    }

    const cleanTitle =
      cleanText(
        title,
        240
      );

    const cleanKnowledge =
      cleanText(
        text,
        50000
      );

    if (!cleanTitle) {
      throw new Error(
        "Knowledge title is required."
      );
    }

    if (!cleanKnowledge) {
      throw new Error(
        "Knowledge text is required."
      );
    }

    const result =
      await syncKnowledgeSource({
        organizationId:
          workspace
            .organization
            ._id,

        agentId: null,

        type:
          normalizedType,

        title:
          cleanTitle,

        text:
          cleanKnowledge,

        metadata: {
          ...metadata,

          sourceKind:
            "owner-entered",

          createdByUser:
            String(userId),
        },

        ...(embedder
          ? {
              embedder,
            }
          : {}),
      });

    return {
      ...workspace,
      source:
        result.source,

      chunksCreated:
        result.chunksCreated,

      unchanged:
        Boolean(
          result.unchanged
        ),
    };
  };

module.exports = {
  OWNER_AGENT_KEY,
  OWNER_KNOWLEDGE_TYPES,
  buildOwnerSlug,
  createOrUpdateOwnerWorkspace,
  findOwnerWorkspace,
  listOwnerKnowledge,
  syncOwnerKnowledge,
};