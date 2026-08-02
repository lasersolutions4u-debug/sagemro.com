export function clampTimelineFrame(activeFrame, frames = []) {
  const lastFrame = Math.max(0, frames.length - 1);
  return Math.min(Math.max(0, Number(activeFrame) || 0), lastFrame);
}

export function stepTimelineFrame(activeFrame, direction, frames = []) {
  return clampTimelineFrame(clampTimelineFrame(activeFrame, frames) + direction, frames);
}

export function shouldPauseTimeline({ previousFrames, frames, previousSimulationId, simulationId, playing }) {
  return Boolean(playing) && (previousFrames !== frames || previousSimulationId !== simulationId);
}
