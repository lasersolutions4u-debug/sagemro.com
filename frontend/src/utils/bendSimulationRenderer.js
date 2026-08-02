function roundCoordinate(value) {
  return Number(Math.round(Number(value || 0) * 1000) / 1000);
}

function formatPoints(points = []) {
  return points.map(({ xMm, yMm }) => `${roundCoordinate(xMm)},${roundCoordinate(yMm)}`).join(' ');
}

function frameFor(result, activeFrame) {
  const frames = Array.isArray(result?.frames) ? result.frames : [];
  if (frames.length === 0) return null;
  const requested = Number.isFinite(Number(activeFrame)) ? Number(activeFrame) : 0;
  return frames[Math.min(Math.max(0, requested), frames.length - 1)];
}

function viewBoxFor(points) {
  if (points.length === 0) return '-50 -50 100 100';
  const xValues = points.map((point) => point.xMm);
  const yValues = points.map((point) => point.yMm);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const padding = Math.max(24, Math.max(maxX - minX, maxY - minY) * 0.18);
  return `${roundCoordinate(minX - padding)} ${roundCoordinate(minY - padding)} ${roundCoordinate(Math.max(1, maxX - minX + padding * 2))} ${roundCoordinate(Math.max(1, maxY - minY + padding * 2))}`;
}

export function buildFlatPath(result) {
  const pointList = Array.isArray(result?.flatPoints) ? result.flatPoints : [];
  return { pointList, points: formatPoints(pointList), viewBox: viewBoxFor(pointList) };
}

export function buildFormedPath(result, activeFrame = 0) {
  const frame = frameFor(result, activeFrame);
  const pointList = Array.isArray(frame?.formedPoints) ? frame.formedPoints : [];
  return {
    pointList,
    points: formatPoints(pointList),
    viewBox: viewBoxFor(pointList),
    activeBendOrder: frame?.activeBendOrder ?? null,
  };
}

export function buildToolGeometry(result, activeFrame = 0) {
  const formed = buildFormedPath(result, activeFrame);
  const activePoint = formed.pointList.at(-1) || { xMm: 0, yMm: 0 };
  const { xMm, yMm } = activePoint;
  const upperTool = `${xMm - 10},${yMm - 28} ${xMm + 10},${yMm - 28} ${xMm + 4},${yMm - 5} ${xMm - 4},${yMm - 5}`;
  const lowerTool = `${xMm - 22},${yMm + 20} ${xMm - 8},${yMm + 6} ${xMm + 8},${yMm + 6} ${xMm + 22},${yMm + 20}`;
  return {
    ...formed,
    upperTool,
    lowerTool,
    machineLabel: result?.machine?.label || 'Press brake',
    upperToolLabel: result?.tooling?.selectedUpperTool?.label || 'Upper tool',
    lowerToolLabel: result?.tooling?.selectedLowerTool?.label || 'Lower tool',
    materialLabel: result?.input?.material?.label || 'Material sheet',
  };
}

export function buildPseudo3DProjection(result, activeFrame = 0) {
  const formed = buildFormedPath(result, activeFrame);
  const offset = { xMm: 12, yMm: -9 };
  const backPoints = formed.pointList.map(({ xMm, yMm }) => ({ xMm: xMm + offset.xMm, yMm: yMm + offset.yMm }));
  return {
    ...formed,
    frontPoints: formed.pointList,
    backPoints,
    front: formed.points,
    back: formatPoints(backPoints),
    sideFaces: formed.pointList.slice(1).map((point, index) => formatPoints([
      formed.pointList[index],
      point,
      backPoints[index + 1],
      backPoints[index],
    ])),
    viewBox: viewBoxFor([...formed.pointList, ...backPoints]),
  };
}
