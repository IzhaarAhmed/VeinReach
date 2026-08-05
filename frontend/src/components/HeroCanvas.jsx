import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Interactive Three.js hero background for the landing page.
 *
 * Renders a slow-drifting field of translucent "blood cells" (biconcave-ish
 * discs) plus a glowing crimson particle haze, with gentle mouse parallax.
 * Sits behind page content (pointer-events: none) and respects
 * prefers-reduced-motion by rendering a single static frame.
 */
export default function HeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a0407, 0.06);

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // ── Lighting ─────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xff5566, 0.6));
    const key = new THREE.PointLight(0xff8a8a, 120, 100);
    key.position.set(8, 10, 12);
    scene.add(key);
    const rim = new THREE.PointLight(0xb91c1c, 80, 100);
    rim.position.set(-12, -6, 6);
    scene.add(rim);

    // ── Blood cells (flattened, dented spheres) ──────────
    const group = new THREE.Group();
    scene.add(group);

    const cellGeo = new THREE.SphereGeometry(1, 48, 32);
    // Pinch the center on both faces to fake a biconcave RBC profile.
    const pos = cellGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const r = Math.hypot(v.x, v.z); // distance from the disc axis
      const dent = (1 - Math.min(r, 1)) * 0.55; // strongest at the center
      v.y *= 0.42; // flatten into a disc
      v.y -= Math.sign(v.y || 1) * dent * Math.abs(v.y) * 1.6;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    cellGeo.computeVertexNormals();

    const palette = [0xb91c1c, 0xdc2626, 0xef4444, 0x991b1b];
    const cells = [];
    const CELL_COUNT = 14;
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const mat = new THREE.MeshStandardMaterial({
        color: palette[i % palette.length],
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        emissive: 0x4c0a0a,
        emissiveIntensity: 0.4,
      });
      const mesh = new THREE.Mesh(cellGeo, mat);
      const s = 0.6 + Math.random() * 1.1;
      mesh.scale.setScalar(s);
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 10 - 2
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.userData = {
        spin: (Math.random() - 0.5) * 0.4,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.4 + Math.random() * 0.5,
        baseY: mesh.position.y,
      };
      group.add(mesh);
      cells.push(mesh);
    }

    // ── Particle haze ────────────────────────────────────
    const PARTICLES = 1400;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i += 1) {
      pPos[i * 3] = (Math.random() - 0.5) * 40;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff6b6b,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── Interaction (mouse parallax) ─────────────────────
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const onPointer = (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer);

    // ── Resize ───────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Render loop ──────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;

    const renderFrame = () => {
      const t = clock.getElapsedTime();

      current.x += (target.x - current.x) * 0.04;
      current.y += (target.y - current.y) * 0.04;

      group.rotation.y = current.x * 0.4 + t * 0.04;
      group.rotation.x = current.y * 0.25;

      cells.forEach((c) => {
        c.rotation.y += c.userData.spin * 0.01;
        c.rotation.z += c.userData.spin * 0.006;
        c.position.y =
          c.userData.baseY +
          Math.sin(t * c.userData.floatSpeed + c.userData.floatPhase) * 0.6;
      });

      particles.rotation.y = t * 0.02 + current.x * 0.15;
      camera.position.x += (current.x * 1.5 - camera.position.x) * 0.05;
      camera.position.y += (-current.y * 1.0 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderFrame);
    };

    if (prefersReduced) {
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(renderFrame);
    }

    // ── Cleanup ──────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      cellGeo.dispose();
      pGeo.dispose();
      pMat.dispose();
      cells.forEach((c) => c.material.dispose());
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
