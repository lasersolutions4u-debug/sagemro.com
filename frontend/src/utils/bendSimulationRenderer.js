function roundCoordinate(value) {
  return Number(Math.round(Number(value || 0) * 1000) / 1000);
}

function isPoint(point) {
  return Number.isFinite(point?.xMm) && Number.isFinite(point?.yMm);
}

function isPointList(points, minimumLength = 1) {
  return Array.isArray(points) && points.length >= minimumLength && points.every(isPoint);
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

function viewBoxFor(points, paddingRatio = 0.18, minimumPadding = 24) {
  if (points.length === 0) return '-50 -50 100 100';
  const xValues = points.map((point) => point.xMm);
  const yValues = points.map((point) => point.yMm);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const padding = Math.max(minimumPadding, Math.max(maxX - minX, maxY - minY) * paddingRatio);
  return `${roundCoordinate(minX - padding)} ${roundCoordinate(minY - padding)} ${roundCoordinate(Math.max(1, maxX - minX + padding * 2))} ${roundCoordinate(Math.max(1, maxY - minY + padding * 2))}`;
}

export function buildFlatPath(result) {
  const pointList = isPointList(result?.flatPoints, 2) ? result.flatPoints : [];
  return { pointList, points: formatPoints(pointList), viewBox: viewBoxFor(pointList) };
}

export function buildFormedPath(result, activeFrame = 0) {
  const frame = frameFor(result, activeFrame);
  const pointList = isPointList(frame?.formedPoints) ? frame.formedPoints : [];
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
  const toolPoints = [
    { xMm: xMm - 10, yMm: yMm - 28 }, { xMm: xMm + 10, yMm: yMm - 28 }, { xMm: xMm + 4, yMm: yMm - 5 }, { xMm: xMm - 4, yMm: yMm - 5 },
    { xMm: xMm - 22, yMm: yMm + 20 }, { xMm: xMm - 8, yMm: yMm + 6 }, { xMm: xMm + 8, yMm: yMm + 6 }, { xMm: xMm + 22, yMm: yMm + 20 },
  ];
  return {
    ...formed,
    upperTool,
    lowerTool,
    toolPoints,
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

export function buildBendSimulationViewportModel(result, activeFrame = 0, viewMode = '2d') {
  const flat = buildFlatPath(result);
  const formed = buildFormedPath(result, activeFrame);
  if (flat.pointList.length === 0 || formed.pointList.length === 0) return { valid: false };

  const tooling = buildToolGeometry(result, activeFrame);
  const projection = buildPseudo3DProjection(result, activeFrame);
  const viewPoints = viewMode === '3d'
    ? [...projection.frontPoints, ...projection.backPoints, ...tooling.toolPoints]
    : [...flat.pointList, ...formed.pointList, ...tooling.toolPoints];
  return {
    valid: true,
    flat,
    formed,
    tooling,
    projection,
    fitViewBox: viewBoxFor(viewPoints, 0.1, 12),
    resetViewBox: viewBoxFor(viewPoints, 0.28, 30),
  };
}

export function selectBendSimulationViewportViewBox(model, fitMode = 'reset') {
  return fitMode === 'fit' ? model.fitViewBox : model.resetViewBox;
}
