/** Vite ?raw imports for GLSL shader files. */
declare module '*.glsl?raw' {
  const src: string;
  export default src;
}
