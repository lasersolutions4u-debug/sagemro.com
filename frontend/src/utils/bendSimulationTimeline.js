export function clampTimelineFrame(activeFrame, frames = []) {
  const lastFrame = Math.max(0, frames.length - 1);
  return Math.min(Math.max(0, Number(activeFrame) || 0), lastFrame);
}

export function stepTimelineFrame(activeFrame, direction, frames = []) {
  return clampTimelineFrame(clampTimelineFrame(activeFrame, frames) + direction, frames);
}

export function shouldPauseTimeline({ previousSimulationId, simulationId, playing }) {
  return Boolean(playing) && previousSimulationId !== simulationId;
}

export function advanceBendPlayback({ activeFrame, frameCount, playing }) {
  const lastFrame = Math.max(0, Number(frameCount) - 1);
  const nextFrame = Math.min(Math.max(0, Number(activeFrame) || 0) + 1, lastFrame);
  return { activeFrame: nextFrame, playing: Boolean(playing) && nextFrame < lastFrame };
}
