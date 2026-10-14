import type { Rect } from '../lib/math/droste';
import { publicAssetUrl } from '../lib/asset-url';

export type HeroExample = {
  id: string;
  title: string;
  src: string;
  shape: 'ellipse' | 'rect';
  /** Normalized [0..1] coordinates of the circular portal opening on the source image. */
  nest: Rect;
  /**
   * Default display zoom multiplier for round (Droste / Escher) panels so the
   * circular period fills the square viewport corner-to-corner (~√2).
   */
  roundZoom: number;
  alt: string;
};

/**
 * Single generated hero photograph for the home-page rewrite proposals,
 * combining the strongest traits of the community contest winners
 * ("The Astronomer's Teapot", "Before the shutter", and "Laundry chute in sage tiles"):
 *
 * - A centered circular portal framed by a wide, richly decorated celestial
 *   majolica, clockwork, and botanical wreath rim (golden sun face, crescent
 *   moon, constellations, meshing brass gears, turquoise/amber gems, and
 *   sculpted leaves, flowers, and berries). Because the complex logarithm
 *   stretches radii near the portal, this ornate collar unrolls into vibrant
 *   vertical painted friezes in panel 1, tilts in panel 2, and winds into a
 *   dense, colorful nautilus spiral filling panel 3.
 * - A sage-and-cream square ceramic tile wall that makes the complex-plane
 *   conformal warp immediately visible.
 * - Four distinct landmarks around the compass (hanging glass prisms above,
 *   brass telescope & sketchbook left, terracotta basil pot & calipers right,
 *   coiled copper wire & red woven camera strap below).
 */
export const HERO_EXAMPLE: HeroExample = {
  id: 'workshop-portal',
  title: 'The Sunlit Workshop Portal',
  src: publicAssetUrl('contest-hero.webp'),
  shape: 'ellipse',
  nest: {
    x: 378.0 / 1024,
    y: 379.0 / 1024,
    w: 267.0 / 1024,
    h: 267.0 / 1024
  },
  roundZoom: 1,
  alt: 'A sunlit craftsman workshop with a circular portal framed by an ornate celestial majolica, brass clockwork, and botanical wreath rim on an oak workbench, backed by sage-and-cream square wall tiles, hanging glass prisms above, a brass telescope and open sketchbook to the left, a terracotta basil pot and calipers to the right, and coiled copper wire with a red woven strap in front.'
};
