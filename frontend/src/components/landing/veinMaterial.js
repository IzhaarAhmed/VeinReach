import * as THREE from 'three';

/**
 * The material both the vein network and the heart core are drawn with.
 *
 * Growth is a vertex-stage effect: each surface vertex knows the centreline
 * point it was extruded from (aCenter) and its normalized arc distance from the
 * seed (aDist). Lerping the vertex onto its centreline collapses the tube to
 * zero radius, so a vessel *swells into existence* rather than being clipped —
 * which is what makes the growth read as organic instead of like a wipe.
 *
 * The same aDist channel drives the pulse wave: a travelling gaussian that
 * momentarily swells and brightens the vessel as it passes.
 */

const vertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uPulse;    // position of the pulse front in aDist space; < 0 = idle
  uniform float uBreath;

  attribute vec3 aCenter;
  attribute float aDist;

  varying float vGrow;
  varying float vPulse;
  varying float vDist;
  varying float vDepth;
  varying vec3 vNrm;
  varying vec3 vView;

  void main() {
    // Reveal everything the growth front has already passed. The soft leading
    // edge (0.055 wide) keeps the tip rounded instead of a hard cut.
    float g = smoothstep(aDist - 0.055, aDist + 0.004, uProgress);

    vec3 offset = position - aCenter;

    // Slow breathing swell — the network never feels frozen.
    float breathe = 1.0 + uBreath * sin(uTime * 0.9 + aDist * 7.0);

    // Travelling pulse.
    float pulse = uPulse < 0.0
      ? 0.0
      : exp(-pow((aDist - uPulse) * 12.0, 2.0));

    vec3 transformed = aCenter + offset * g * breathe * (1.0 + pulse * 0.4);

    vGrow = g;
    vPulse = pulse;
    vDist = aDist;

    vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
    vNrm = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHot;
  uniform float uOpacity;

  varying float vGrow;
  varying float vPulse;
  varying float vDist;
  varying float vDepth;
  varying vec3 vNrm;
  varying vec3 vView;

  void main() {
    if (vGrow <= 0.002) discard;

    // Wet-tissue rim light. Grazing angles catch the highlight, which is also
    // what the bloom pass latches onto.
    float fres = pow(1.0 - clamp(dot(normalize(vNrm), normalize(vView)), 0.0, 1.0), 2.2);

    // Thick trunks read near-black crimson; capillaries run hotter.
    vec3 base = mix(uDeep, uMid, smoothstep(0.12, 0.95, vDist));
    vec3 col = mix(base, uHot, fres * 0.7 + vPulse * 0.55);
    col += uHot * vPulse * 0.5;

    // The advancing tip glows, then cools as the vessel settles.
    float tip = smoothstep(0.0, 0.3, vGrow) * (1.0 - smoothstep(0.5, 1.0, vGrow));
    col += uHot * tip * 0.4;

    // Aerial perspective — vessels dissolve into the haze with distance, which
    // is what gives the network depth once the camera flies into it on scroll.
    float depthFade = 1.0 - smoothstep(11.0, 27.0, vDepth) * 0.85;

    gl_FragColor = vec4(col, uOpacity * smoothstep(0.0, 0.22, vGrow) * depthFade);
  }
`;

export const PALETTE = {
  deep: '#4A0000',
  mid: '#8B0000',
  hot: '#C1121F',
};

/**
 * @param {object} [opts]
 * @param {number} [opts.breath]   breathing amplitude (0 disables)
 * @param {number} [opts.opacity]
 */
export function createVeinMaterial({ breath = 0.045, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    // Vessels are viewed from both sides where they cross the frame.
    side: THREE.DoubleSide,
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uPulse: { value: -1 },
      uBreath: { value: breath },
      uOpacity: { value: opacity },
      uDeep: { value: new THREE.Color(PALETTE.deep) },
      uMid: { value: new THREE.Color(PALETTE.mid) },
      uHot: { value: new THREE.Color(PALETTE.hot) },
    },
  });
}
