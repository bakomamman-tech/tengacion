const KnowledgeChunk =
  require(
    "../../models/tengaAgent/KnowledgeChunk"
  );

const {
  embedText,
} = require(
  "../../integrations/tengaAgent/embeddings"
);

const cosineSimilarity = (
  left,
  right
) => {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length === 0 ||
    left.length !==
      right.length
  ) {
    return -1;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    const a =
      Number(left[index]) || 0;

    const b =
      Number(right[index]) || 0;

    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }

  if (
    leftMagnitude === 0 ||
    rightMagnitude === 0
  ) {
    return -1;
  }

  return (
    dot /
    (
      Math.sqrt(leftMagnitude) *
      Math.sqrt(rightMagnitude)
    )
  );
};

const retrieveKnowledge =
  async ({
    organizationId,
    agentId = null,
    query,
    limit = 5,
    candidateLimit = 200,
    embedder = embedText,
  }) => {
    const cleanQuery =
      String(query || "")
        .trim();

    if (
      !organizationId ||
      !cleanQuery
    ) {
      return [];
    }

    const queryEmbedding =
      await embedder(
        cleanQuery
      );

    if (
      !Array.isArray(
        queryEmbedding
      ) ||
      queryEmbedding.length === 0
    ) {
      return [];
    }

    const filter = {
      organizationId,
    };

    if (agentId) {
      filter.$or = [
        {
          agentId: null,
        },
        {
          agentId,
        },
      ];
    } else {
      filter.agentId =
        null;
    }

    const candidates =
      await KnowledgeChunk
        .find(filter)
        .sort({
          updatedAt: -1,
        })
        .limit(
          Math.max(
            1,
            Math.min(
              Number(
                candidateLimit
              ) || 200,
              500
            )
          )
        )
        .lean();

    return candidates
      .map((chunk) => ({
        sourceId:
          chunk.sourceId,
        chunkId:
          chunk._id,
        chunkIndex:
          chunk.chunkIndex,
        text:
          chunk.text,
        metadata:
          chunk.metadata || {},
        score:
          cosineSimilarity(
            queryEmbedding,
            chunk.embedding
          ),
      }))
      .filter(
        (result) =>
          Number.isFinite(
            result.score
          ) &&
          result.score > 0
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(
        0,
        Math.max(
          1,
          Math.min(
            Number(limit) || 5,
            12
          )
        )
      );
  };

module.exports = {
  cosineSimilarity,
  retrieveKnowledge,
};