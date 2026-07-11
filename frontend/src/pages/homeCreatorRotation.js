export const buildAlphabeticalCreatorRotation = (items = []) => {
  const creatorGroups = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const creatorKey = String(item?.creatorId || item?.creatorUsername || item?.creatorName || "")
      .trim()
      .toLowerCase();
    if (!creatorKey) {continue;}
    if (!creatorGroups.has(creatorKey)) {
      creatorGroups.set(creatorKey, {
        key: creatorKey,
        name: String(item?.creatorName || item?.creatorUsername || creatorKey).trim(),
        items: [],
      });
    }
    creatorGroups.get(creatorKey).items.push(item);
  }

  const groups = [...creatorGroups.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
      || left.key.localeCompare(right.key)
  );

  groups.forEach((group) => {
    group.items.sort((left, right) =>
      String(left?.title || "").localeCompare(String(right?.title || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      }) || String(left?.id || left?.contentId || "").localeCompare(
        String(right?.id || right?.contentId || "")
      )
    );
  });

  const rotation = [];
  const longestCatalog = Math.max(0, ...groups.map((group) => group.items.length));
  for (let releaseIndex = 0; releaseIndex < longestCatalog; releaseIndex += 1) {
    groups.forEach((group) => {
      if (group.items[releaseIndex]) {
        rotation.push(group.items[releaseIndex]);
      }
    });
  }

  return rotation;
};
