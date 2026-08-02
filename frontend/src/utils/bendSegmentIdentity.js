export function ensureBendSegmentIds(segments = []) {
  const used = new Set();
  let nextGeneratedId = 1;

  return segments.map((segment) => {
    const suppliedId = typeof segment?.id === 'string' ? segment.id.trim() : '';
    let id = suppliedId && !used.has(suppliedId) ? suppliedId : '';
    while (!id || used.has(id)) {
      id = `segment-${nextGeneratedId}`;
      nextGeneratedId += 1;
    }
    used.add(id);
    return { ...segment, id };
  });
}
