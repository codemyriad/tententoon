#version 300 es

/** Fullscreen-quad vertex shader. The quad covers clip-space [-1, 1]², so
 *  the fragment shader's gl_FragCoord runs over the whole canvas. */

layout(location = 0) in vec2 a_pos;

void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
