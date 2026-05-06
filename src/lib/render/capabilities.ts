/**
 * Pick the rendering tier once, at startup.
 *
 *   1. WebGL2 absent → cpu-main. (Chrome ≥130 returns null instead of
 *      falling back to SwiftShader; older browsers may also lack it.)
 *   2. WebGL2 present but UNMASKED_RENDERER reports software rasteriser
 *      (SwiftShader / llvmpipe) → cpu-main. The JS loop here is faster
 *      than software-rasterised WebGL2 for our shader workload.
 *   3. WebGL2 + OffscreenCanvas + transferControlToOffscreen → webgl2-worker.
 *   4. WebGL2 alone → webgl2-main.
 */

import type { BackendTier, Capabilities } from './types';

const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|software|microsoft basic render/i;

export function detectCapabilities(): Capabilities {
  let webgl2 = false;
  let rendererName = '';
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      rendererName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
      webgl2 = !SOFTWARE_RENDERER.test(rendererName);
      // Drop the probe context immediately; we'll create real ones per-panel.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Any throw → assume no WebGL2. Defensive against odd browser configs.
  }
  const hasOffscreen =
    typeof OffscreenCanvas !== 'undefined' &&
    'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  return { webgl2, hasOffscreen, rendererName };
}

export function pickTier(caps: Capabilities): BackendTier {
  if (caps.webgl2 && caps.hasOffscreen) return 'webgl2-worker';
  if (caps.webgl2) return 'webgl2-main';
  return 'cpu-main';
}
