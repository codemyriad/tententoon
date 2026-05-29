/**
 * Shared, experimental controls for the pipeline view (geometry lab).
 *
 *  angleDeg — override the rotated-log rotation / tententoon twist. null uses
 *             the canonical β = atan(logS/2π); any other angle shows that the
 *             spiral only "closes up" with the Droste scale at β.
 *  panU/panV— a pan in log space, applied to every panel. Dragging the
 *             rotated-log panel writes here, so you can watch the same shift
 *             zoom (u) and rotate (v) the tententoon.
 *
 * Pure UI state; the render functions read it via the component. Reset when
 * leaving/entering the view so a stashed pan doesn't surprise later.
 */

export const experiment = $state<{
  angleDeg: number | null;
  panU: number;
  panV: number;
}>({
  angleDeg: null,
  panU: 0,
  panV: 0
});

export function resetExperiment(): void {
  experiment.angleDeg = null;
  experiment.panU = 0;
  experiment.panV = 0;
}

/** True when any experiment control is off its canonical default. */
export function experimentActive(): boolean {
  return experiment.angleDeg !== null || experiment.panU !== 0 || experiment.panV !== 0;
}
