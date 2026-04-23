function cloneSectionMetaItem(item) {
  return item ? { ...item } : item;
}

function sortSectionMeta(sectionMeta = []) {
  return [...sectionMeta].sort((left, right) => {
    const leftOrder = Number.isInteger(left?.order) ? left.order : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isInteger(right?.order) ? right.order : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function reindexSectionMeta(sectionMeta) {
  return sectionMeta.map((item, index) => ({
    ...item,
    order: index,
  }));
}

export function alignSectionMetaToSourceResume(sourceResumeData, targetResumeData) {
  const sourceSectionMeta = Array.isArray(sourceResumeData?.sectionMeta)
    ? sortSectionMeta(sourceResumeData.sectionMeta)
    : [];
  const targetSectionMeta = Array.isArray(targetResumeData?.sectionMeta)
    ? sortSectionMeta(targetResumeData.sectionMeta)
    : [];

  if (!targetResumeData || typeof targetResumeData !== "object") {
    return targetResumeData;
  }
  if (sourceSectionMeta.length === 0 || targetSectionMeta.length === 0) {
    return targetResumeData;
  }

  const targetByKey = new Map(targetSectionMeta.map((item) => [item.key, item]));
  const nextMeta = [];
  const usedKeys = new Set();

  sourceSectionMeta.forEach((sourceItem) => {
    if (!sourceItem?.key) {
      return;
    }

    const targetItem = targetByKey.get(sourceItem.key);
    const base = targetItem ? cloneSectionMetaItem(targetItem) : cloneSectionMetaItem(sourceItem);

    usedKeys.add(sourceItem.key);
    nextMeta.push({
      ...base,
      id: sourceItem.id,
      key: sourceItem.key,
      displayName: sourceItem.displayName,
      sectionType: sourceItem.sectionType,
      isDefault: sourceItem.isDefault,
      isVisible: sourceItem.isVisible,
      order: sourceItem.order,
    });
  });

  let nextOrder = nextMeta.length;
  targetSectionMeta.forEach((targetItem) => {
    if (!targetItem?.key || usedKeys.has(targetItem.key)) {
      return;
    }

    usedKeys.add(targetItem.key);
    nextMeta.push({
      ...cloneSectionMetaItem(targetItem),
      order: nextOrder,
    });
    nextOrder += 1;
  });

  return {
    ...targetResumeData,
    sectionMeta: reindexSectionMeta(nextMeta),
  };
}
