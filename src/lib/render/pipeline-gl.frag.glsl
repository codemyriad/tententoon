#version 300 es
precision highp float;

/**
 * Fragment shader for the 4-panel pipeline explorable. One shader, three
 * modes (selected by u_mode); they differ only in how the output pixel maps
 * to a source point `src` in working coords. The Droste-fold + mipmap sample
 * tail is shared.
 *
 *   mode 0  log(z − c)      : fill the cell with the (logS, 2π) lattice.
 *   mode 1  rotated log      : same lattice rotated by β = atan(logS/2π).
 *   mode 2  tententoon still : (z − c)^α, α = 1 − i·logS/2π, at t = 0.
 *
 * log / rotlog map the WHOLE canvas (no letterbox): log space is doubly
 * periodic, so every pixel folds to a valid source ring — the panel tiles
 * infinitely with no black margins. escher maps working coords through the
 * Lenstra spiral exactly like the live renderer (shader.frag.glsl) at t = 0.
 */

uniform sampler2D u_src;
uniform vec2  u_canvas;       // canvas size (W, H) in pixels
uniform int   u_mode;         // 0 = log, 1 = rotlog, 2 = escher
uniform vec2  u_c;            // limit point in working coords
uniform float u_logS;
uniform float u_rMax;
uniform vec2  u_workingSize;  // (W, H) of the working rect (crop)
uniform vec2  u_crop;         // crop offset (cropX, cropY)
uniform float u_sampleScale;  // 1 for raw source, > 1 for HQ
uniform vec2  u_texSize;      // texture pixel dims (after sampleScale)

// log / rotlog params
uniform float u_pxPerUnit;    // canvas px per log-space unit (equal both axes)
uniform float u_uRef;         // log-radius anchored at the canvas centre

// escher params
uniform float u_scale;        // canvas-px per working-px
uniform float u_lnR0;         // log of the orientation radius R0

out vec4 fragColor;

const float TWO_PI = 6.283185307179586;

void main() {
  // y-down pixel coords (origin top-left, like the source image).
  vec2 pxd = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y);
  float k = u_logS / TWO_PI;

  vec2 src;
  float footA; // footprint = footA · exp(n·logS); set per mode.

  if (u_mode == 2) {
    // --- tententoon still ---
    vec2 work = pxd / u_scale;
    vec2 d = work - u_c;
    float R2 = dot(d, d);
    if (R2 < 1e-12) { fragColor = vec4(0.0); return; }
    float lnR = 0.5 * log(R2);
    float Phi = atan(d.y, d.x);
    float bLnR = lnR + k * Phi;
    float nPhi = Phi - k * (lnR - u_lnR0);
    float r = exp(bLnR);
    src = u_c + r * vec2(cos(nPhi), sin(nPhi));
    footA = sqrt(1.0 + k * k) * exp(k * Phi) / u_scale;
  } else {
    // --- log / rotated log: fill the cell, centred anchor ---
    float cu = (pxd.x - u_canvas.x * 0.5) / u_pxPerUnit;
    float cv = (pxd.y - u_canvas.y * 0.5) / u_pxPerUnit;
    float u, v;
    if (u_mode == 1) {
      // Un-rotate by −β: (u, v) = R(−β)·(u', v'). cos/sin β from logS, 2π.
      float L = sqrt(u_logS * u_logS + TWO_PI * TWO_PI);
      float cosB = TWO_PI / L;     // cos(atan(logS/2π))
      float sinB = u_logS / L;     // sin(atan(logS/2π))
      u = cu * cosB + cv * sinB + u_uRef;
      v = -cu * sinB + cv * cosB;
    } else {
      u = cu + u_uRef;
      v = cv;
    }
    float r = exp(u);
    src = u_c + r * vec2(cos(v), sin(v));
    footA = r / u_pxPerUnit;
  }

  // --- shared Droste fold + mipmap sample ---
  vec2 sd = src - u_c;
  float r2 = length(sd);
  if (r2 < 1e-12) { fragColor = vec4(0.0); return; }
  float n0 = floor((log(u_rMax) - log(r2)) / u_logS);

  vec4 col = vec4(0.0);
  for (int dn = 0; dn <= 10; dn++) {
    float n = n0 - float(dn);
    float s = exp(n * u_logS);
    vec2 tcoord = u_c + sd * s;
    if (tcoord.x >= 0.0 && tcoord.y >= 0.0 &&
        tcoord.x <= u_workingSize.x - 1.0 &&
        tcoord.y <= u_workingSize.y - 1.0) {
      float footprint = footA * s;
      float lod = max(0.0, log2(footprint));
      vec2 uv = (tcoord + u_crop) * u_sampleScale / u_texSize;
      col = textureLod(u_src, uv, lod);
      break;
    }
  }
  fragColor = col;
}
