const crypto =
  require("crypto");

const KnowledgeSource =
  require(
    "../../models/tengaAgent/KnowledgeSource"
  );

const KnowledgeChunk =
  require(
    "../../models/tengaAgent/KnowledgeChunk"
  );

const {
  EMBEDDING_MODEL,
  embedTexts,
} = require(
  "../../integrations/tengaAgent/embeddings"
);

const {
  chunkKnowledgeText,
  estimateTokens,
  normalizeKnowledgeText,
} = require(
  "./knowledgeChunkingService"
);

const hashText = (
  value
) =>
  crypto
    .createHash("sha256")
    .update(
      String(value || ""),
      "utf8"
    )
    .digest("hex");

const ingestKnowledgeSource =
  async ({
    organizationId,
    agentId = null,
    type = "manual",
    title,
    text,
    sourceUrl = "",
    metadata = {},
    embedder = embedTexts,
  }) => {
    const normalizedText =
      normalizeKnowledgeText(text);

    if (!organizationId) {
      throw new Error(
        "organizationId is required."
      );
    }

    if (!title?.trim()) {
      throw new Error(
        "Knowledge source title is required."
      );
    }

    if (!normalizedText) {
      throw new Error(
        "Knowledge source text is required."
      );
    }

    const source =
      await KnowledgeSource.create({
        organizationId,
        agentId,
        type,
        title:
          title.trim(),
        sourceUrl,
        contentHash:
          hashText(normalizedText),
        status: "processing",
        metadata,
      });

    try {
      const chunks =
        chunkKnowledgeText(
          normalizedText
        );

      if (chunks.length === 0) {
        throw new Error(
          "No knowledge chunks were produced."
        );
      }

      const embeddings =
        await embedder(chunks);

      if (
        !Array.isArray(
          embeddings
        ) ||
        embeddings.length !==
          chunks.length
      ) {
        throw new Error(
          "Knowledge embeddings were unavailable."
        );
      }

      const documents =
        chunks.map(
          (chunk, chunkIndex) => {
            const embedding =
              embeddings[
                chunkIndex
              ];

            if (
              !Array.isArray(
                embedding
              ) ||
              embedding.length === 0
            ) {
              throw new Error(
                "Knowledge embedding was empty."
              );
            }

            return {
              organizationId,
              agentId,
              sourceId:
                source._id,
              chunkIndex,
              text: chunk,
              contentHash:
                hashText(chunk),
              tokenEstimate:
                estimateTokens(
                  chunk
                ),
              embedding,
              embeddingModel:
                EMBEDDING_MODEL,
              embeddingDimensions:
                embedding.length,
              metadata,
            };
          }
        );

      await KnowledgeChunk.insertMany(
        documents
      );

      source.status =
        "ready";

      source.chunkCount =
        documents.length;

      source.errorMessage =
        "";

      await source.save();

      return {
        source,
        chunksCreated:
          documents.length,
      };
    } catch (error) {
      await KnowledgeChunk.deleteMany({
        sourceId:
          source._id,
      });

      source.status =
        "failed";

      source.errorMessage =
        String(
          error?.message ||
            "Knowledge ingestion failed."
        ).slice(0, 1000);

      await source.save();

      throw error;
    }
  };

module.exports = {
  hashText,
  ingestKnowledgeSource,
};