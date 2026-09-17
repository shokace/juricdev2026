"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { subscribeIss } from "@/lib/iss-feed";
import { mergeIssTrail, normalizeIssTrail } from "@/lib/iss-data.mjs";

type Point = { lat: number; lon: number; ts: number };
const ORBIT_RADIUS = 1.07;
const CAMERA_DISTANCE = 3.85;
const MARKER_START: [number, number, number] = [0, 0, ORBIT_RADIUS];
const UP = new THREE.Vector3(0, 1, 0);

function position(lat: number, lon: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function graticule() {
  const vertices: number[] = [];
  const segment = (a: THREE.Vector3, b: THREE.Vector3) => { vertices.push(...a.toArray(), ...b.toArray()); };
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 5) segment(position(lat, lon, 1.008), position(lat, lon + 5, 1.008));
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -90; lat < 90; lat += 5) segment(position(lat, lon, 1.008), position(lat + 5, lon, 1.008));
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
}

function trailGeometry(points: Point[]) {
  const newest = points.at(-1)?.ts ?? 0;
  const recent = points.filter(point => newest - point.ts <= 90 * 60_000);
  const segments: THREE.Vector3[][] = [];
  for (let i = 0; i < recent.length; i++) {
    if (i === 0 || recent[i].ts - recent[i-1].ts > 8 * 60_000) segments.push([]);
    segments.at(-1)!.push(position(recent[i].lat, recent[i].lon, ORBIT_RADIUS));
  }
  return segments.filter(segment => segment.length > 1).map(segment => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(segment), Math.min(360, Math.max(24, segment.length * 3)), 0.0035, 5, false));
}

function GlobeMesh({ points, follow, reduced }: { points: Point[]; follow: boolean; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const sourceTexture = useLoader(THREE.TextureLoader, "/textures/earth-watermask.png");
  const land = useMemo(() => {
    const image = sourceTexture.image as HTMLImageElement;
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.filter = "invert(1)"; context.drawImage(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [sourceTexture]);
  const grid = useMemo(() => graticule(), []);
  const trails = useMemo(() => trailGeometry(points), [points]);
  const target = useMemo(() => {
    const point = points.at(-1);
    return point ? position(point.lat, point.lon, ORBIT_RADIUS) : null;
  }, [points]);
  const rotation = useMemo(() => {
    if (!target) return new THREE.Quaternion();
    const forward = target.clone().normalize();
    const right = new THREE.Vector3().crossVectors(Math.abs(forward.y) > 0.999 ? new THREE.Vector3(0, 0, 1) : UP, forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward)).invert();
  }, [target]);
  useEffect(() => () => land?.dispose(), [land]);
  useEffect(() => () => grid.dispose(), [grid]);
  useEffect(() => () => trails.forEach(geometry => geometry.dispose()), [trails]);
  useFrame((state, delta) => {
    const blend = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 3);
    if (group.current && follow) group.current.quaternion.slerp(rotation, blend);
    if (marker.current && target) {
      marker.current.position.lerp(target, blend).setLength(ORBIT_RADIUS);
      marker.current.scale.setScalar(reduced ? 1 : 1 + Math.sin(state.clock.elapsedTime * 2.6) * 0.13);
    }
  });
  return (
    <group ref={group}>
      <mesh><sphereGeometry args={[1, 96, 64]} /><meshPhongMaterial color="#172b35" shininess={12} /></mesh>
      {land && <mesh><sphereGeometry args={[1.003, 96, 64]} /><meshLambertMaterial color="#91afa0" alphaMap={land} alphaTest={0.45} /></mesh>}
      <lineSegments geometry={grid}><lineBasicMaterial color="#d2e1df" transparent opacity={0.12} depthWrite={false} /></lineSegments>
      <mesh><sphereGeometry args={[1.025, 64, 48]} /><meshBasicMaterial color="#97c0d0" side={THREE.BackSide} transparent opacity={0.12} depthWrite={false} /></mesh>
      {trails.map((geometry, index) => <mesh key={index} geometry={geometry}><meshBasicMaterial color="#9fceeb" /></mesh>)}
      {target && <mesh ref={marker} position={MARKER_START}><sphereGeometry args={[0.017, 16, 12]} /><meshBasicMaterial color="#ecf9ff" /></mesh>}
    </group>
  );
}

function CameraControls({ follow, reduced }: { follow: boolean; reduced: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const control = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false; orbit.enableZoom = false; orbit.enabled = !follow;
    orbit.enableDamping = !reduced; orbit.dampingFactor = 0.08; orbit.rotateSpeed = 0.6;
    orbit.domElement!.style.touchAction = follow ? "pan-y" : "none";
    if (follow) { camera.position.set(0, 0, CAMERA_DISTANCE); camera.lookAt(0, 0, 0); }
    const onChange = () => invalidate();
    orbit.addEventListener("change", onChange);
    control.current = orbit;
    invalidate();
    return () => { orbit.removeEventListener("change", onChange); orbit.dispose(); control.current = null; };
  }, [camera, gl, invalidate, follow, reduced]);
  useFrame(() => { if (control.current?.enabled) control.current.update(); });
  return null;
}

const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
function subscribeMotion(callback: () => void) { const query = motionQuery(); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); }
function subscribeVisibility(callback: () => void) { document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); }

class GlobeBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="globe-fallback">The 3D view is unavailable.<br />Live coordinates are shown below.</div> : this.props.children; }
}

export default function Globe3D() {
  const [points, setPoints] = useState<Point[]>([]);
  const [follow, setFollow] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2");
      setWebgl(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [inView, setInView] = useState(true);
  const element = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(subscribeMotion, () => motionQuery().matches, () => true);
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
  const active = inView && visible;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => subscribeIss(snapshot => {
    if (!snapshot.timestamp || !Number.isFinite(Number(snapshot.latitude)) || !Number.isFinite(Number(snapshot.longitude))) return;
    const incoming = [...normalizeIssTrail(snapshot.trail), { lat: Number(snapshot.latitude), lon: Number(snapshot.longitude), ts: snapshot.timestamp * 1000 }];
    setPoints(previous => mergeIssTrail(previous, incoming));
  }), []);
  return (
    <div ref={element} className="iss-globe" data-rendering={active ? reduced ? "reduced" : "active" : "paused"}>
      <div className="globe-stage" role="img" aria-label="Three-dimensional Earth showing the International Space Station and its recent recorded path">
        <GlobeBoundary>
          {webgl === false ? <div className="globe-fallback">3D requires WebGL.<br />Live coordinates are shown below.</div> : webgl ? <Canvas camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 35 }} dpr={[1, 1.5]} frameloop={!active ? "never" : reduced ? "demand" : "always"} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} fallback={<div className="globe-fallback">3D requires WebGL.<br />Live coordinates are shown below.</div>}>
            <ambientLight intensity={0.7} /><directionalLight position={[3, 3, 5]} intensity={2} />
            <Suspense fallback={<mesh><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial wireframe color="#41564f" /></mesh>}>
              <GlobeMesh points={points} follow={follow} reduced={reduced} />
            </Suspense>
            <CameraControls follow={follow} reduced={reduced} />
          </Canvas> : null}
        </GlobeBoundary>
      </div>
      <div className="globe-toolbar">
        <span className="orbit-legend"><i aria-hidden="true" />ISS · recent path</span>
        <button type="button" className="globe-control" aria-pressed={!follow} onClick={() => setFollow(value => !value)}>{follow ? "Explore globe" : "Follow ISS"}<span aria-hidden="true">{follow ? " ↗" : " ↺"}</span></button>
      </div>
      <p className="globe-hint" aria-live="polite">{follow ? "Following the station in real time" : "Drag to rotate · select Follow ISS to return"}</p>
    </div>
  );
}
