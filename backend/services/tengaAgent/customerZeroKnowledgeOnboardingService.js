const {
  ensureCustomerZeroAgent,
} = require(
  "./customerZeroService"
);

const {
  fetchWebsiteText,
} = require(
  "./websiteKnowledgeService"
);

const {
  syncKnowledgeSource,
} = require(
  "./knowledgeIngestionService"
);

const CUSTOMER_ZERO_WEBSITE_PAGES =
  [
    {
      title:
        "Tengacion homepage",
      url:
        "https://tengacion.com/",
    },
    {
      title:
        "About Tengacion",
      url:
        "https://tengacion.com/about",
    },
    {
      title:
        "How Tengacion works",
      url:
        "https://tengacion.com/how-it-works",
    },
    {
      title:
        "Tengacion for creators",
      url:
        "https://tengacion.com/for-creators",
    },
    {
      title:
        "Tengacion leadership",
      url:
        "https://tengacion.com/leadership",
    },
    {
      title:
        "Tengacion music",
      url:
        "https://tengacion.com/music",
    },
    {
      title:
        "Tengacion books",
      url:
        "https://tengacion.com/books",
    },
    {
      title:
        "Tengacion podcasts",
      url:
        "https://tengacion.com/podcasts",
    },
    {
      title:
        "Tengacion marketplace",
      url:
        "https://tengacion.com/marketplace",
    },
    {
      title:
        "Tengacion community guidelines",
      url:
        "https://tengacion.com/community-guidelines",
    },
    {
      title:
        "Tengacion terms",
      url:
        "https://tengacion.com/terms",
    },
    {
      title:
        "Tengacion privacy policy",
      url:
        "https://tengacion.com/privacy",
    },
    {
      title:
        "Tengacion child safety",
      url:
        "https://tengacion.com/child-safety",
    },
    {
      title:
        "Tengacion refund policy",
      url:
        "https://tengacion.com/refund-policy",
    },
    {
      title:
        "Tengacion contact and reports",
      url:
        "https://tengacion.com/contact",
    },
  ];

const syncCustomerZeroWebsiteKnowledge =
  async ({
    fetchImpl =
      global.fetch,
    sourceSync =
      syncKnowledgeSource,
  } = {}) => {
    const {
      organization,
      agent,
    } =
      await ensureCustomerZeroAgent();

    const results = [];

    for (
      const page of
      CUSTOMER_ZERO_WEBSITE_PAGES
    ) {
      try {
        const fetched =
          await fetchWebsiteText({
            url: page.url,
            fetchImpl,
          });

        const synced =
          await sourceSync({
            organizationId:
              organization._id,

            // Public company knowledge
            // is shared by every agent
            // belonging to this tenant.
            agentId: null,

            type:
              "website",

            title:
              page.title,

            sourceUrl:
              page.url,

            text:
              fetched.text,

            metadata: {
              sourceKind:
                "customer-zero-public-website",
              canonicalUrl:
                page.url,
              fetchedUrl:
                fetched.finalUrl,
            },
          });

        results.push({
          ok: true,
          title:
            page.title,
          url:
            page.url,
          chunks:
            synced.chunksCreated,
          unchanged:
            Boolean(
              synced.unchanged
            ),
        });
      } catch (error) {
        results.push({
          ok: false,
          title:
            page.title,
          url:
            page.url,
          error:
            String(
              error?.message ||
                "Unknown ingestion error"
            ),
        });
      }
    }

    const succeeded =
      results.filter(
        (entry) =>
          entry.ok
      ).length;

    const failed =
      results.length -
      succeeded;

    if (
      succeeded === 0
    ) {
      throw new Error(
        "Customer #0 website knowledge synchronization failed for every source."
      );
    }

    return {
      organization,
      agent,
      total:
        results.length,
      succeeded,
      failed,
      results,
    };
  };

module.exports = {
  CUSTOMER_ZERO_WEBSITE_PAGES,
  syncCustomerZeroWebsiteKnowledge,
};