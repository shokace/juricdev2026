"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type GlobeMeshProps = {
  size?: number;
  issPoints: IssPoint[];
  issTarget: THREE.Vector3 | null;
};

type IssPoint = {
  lat: number;
  lon: number;
  ts: number;
};

const ISS_RADIUS = 1.18;
const ISS_TRAIL_MAX_POINTS = 2400;
const ISS_TRAIL_SEGMENT_GAP_MS = 8 * 60 * 1000;
const ISS_TRAIL_MAX_ANGULAR_DISTANCE = Math.PI;

function normalizeTrail(trail: unknown): IssPoint[] {
  if (!Array.isArray(trail)) {
    return [];
  }

  return trail
    .filter(
      (point): point is IssPoint =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as IssPoint).lat === "number" &&
        typeof (point as IssPoint).lon === "number" &&
        typeof (point as IssPoint).ts === "number"
    )
    .sort((a, b) => a.ts - b.ts);
}

function buildTrailKey(point: IssPoint): string {
  return `${point.ts}:${point.lat.toFixed(4)}:${point.lon.toFixed(4)}`;
}

function mergeTrails(trailGroups: IssPoint[][]): IssPoint[] {
  const deduped = new Map<string, IssPoint>();

  for (const group of trailGroups) {
    for (const point of group) {
      deduped.set(buildTrailKey(point), point);
    }
  }

  const merged = Array.from(deduped.values()).sort((a, b) => a.ts - b.ts);
  if (merged.length <= ISS_TRAIL_MAX_POINTS) {
    return merged;
  }

  return merged.slice(-ISS_TRAIL_MAX_POINTS);
}

function toUnitVector(point: IssPoint): THREE.Vector3 {
  return toIssVector(point).normalize();
}

function getVisibleTrailPoints(points: IssPoint[]): IssPoint[] {
  if (points.length < 2) {
    return points;
  }

  const visible: IssPoint[] = [points[points.length - 1]];
  let totalAngle = 0;

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const olderPoint = points[index];
    const newerPoint = visible[0];

    if (newerPoint.ts - olderPoint.ts > ISS_TRAIL_SEGMENT_GAP_MS) {
      break;
    }

    const olderVector = toUnitVector(olderPoint);
    const newerVector = toUnitVector(newerPoint);
    const angle = olderVector.angleTo(newerVector);

    if (!Number.isFinite(angle) || angle <= 0) {
      continue;
    }

    if (totalAngle + angle > ISS_TRAIL_MAX_ANGULAR_DISTANCE) {
      break;
    }

    visible.unshift(olderPoint);
    totalAngle += angle;
  }

  return visible;
}

function toIssVector(point: IssPoint): THREE.Vector3 {
  const phi = (90 - point.lat) * (Math.PI / 180);
  const theta = (point.lon + 180) * (Math.PI / 180);
  const x = -ISS_RADIUS * Math.sin(phi) * Math.cos(theta);
  const z = ISS_RADIUS * Math.sin(phi) * Math.sin(theta);
  const y = ISS_RADIUS * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function interpolateArc(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
  const a = start.clone().normalize();
  const b = end.clone().normalize();
  const angle = a.angleTo(b);
  if (!Number.isFinite(angle) || angle === 0) {
    return [start.clone(), end.clone()];
  }

  const steps = Math.max(2, Math.ceil(angle / (Math.PI / 90)));
  const axis = new THREE.Vector3().crossVectors(a, b);

  if (axis.lengthSq() < 1e-10) {
    const fallback: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      fallback.push(a.clone().lerp(b, t).normalize().multiplyScalar(ISS_RADIUS));
    }
    return fallback;
  }

  axis.normalize();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle * t);
    points.push(a.clone().applyQuaternion(q).normalize().multiplyScalar(ISS_RADIUS));
  }
  return points;
}

function buildTrailGeometry(points: THREE.Vector3[]): THREE.TubeGeometry | null {
  if (points.length < 2) {
    return null;
  }

  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  return new THREE.TubeGeometry(curve, Math.max(80, points.length * 2), 0.012, 8, false);
}

function GlobeMesh({ size = 1, issPoints, issTarget }: GlobeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const issRef = useRef<THREE.Mesh>(null);
  const currentIssRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const targetQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const earthTexture = useLoader(THREE.TextureLoader, "/textures/earth-watermask.png");
  earthTexture.colorSpace = THREE.NoColorSpace;
  earthTexture.anisotropy = 8;
  earthTexture.minFilter = THREE.LinearMipmapLinearFilter;
  earthTexture.magFilter = THREE.LinearFilter;

  const issPositions = useMemo(() => issPoints.map(toIssVector), [issPoints]);
  const visibleTrailPoints = useMemo(() => getVisibleTrailPoints(issPoints), [issPoints]);

  useFrame((_state, delta) => {
    if (groupRef.current && issPositions.length) {
      const target = issPositions[issPositions.length - 1].clone().normalize();
      const forward = new THREE.Vector3(0, 0, 1);
      const poleProximity = Math.abs(target.y);
      const poleDampen = THREE.MathUtils.smoothstep(poleProximity, 0.45, 0.9);
      const dampenedTarget = new THREE.Vector3(
        target.x,
        target.y * (1 - poleDampen * 0.8),
        target.z
      ).normalize();
      const blendedTarget = dampenedTarget;
      const worldUp = new THREE.Vector3(0, 1, 0);
      const forwardWorld = blendedTarget;
      const rightWorld = new THREE.Vector3().crossVectors(worldUp, forwardWorld).normalize();
      const upWorld = new THREE.Vector3().crossVectors(forwardWorld, rightWorld).normalize();
      const worldBasis = new THREE.Matrix4().makeBasis(rightWorld, upWorld, forwardWorld);
      const viewBasis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
      );
      const rotationMatrix = new THREE.Matrix4()
        .copy(viewBasis)
        .multiply(worldBasis.clone().invert());
      targetQuatRef.current.setFromRotationMatrix(rotationMatrix);
      if (currentQuatRef.current.lengthSq() === 0) {
        currentQuatRef.current.copy(targetQuatRef.current);
      } else {
        currentQuatRef.current.slerp(targetQuatRef.current, 0.04);
      }
      groupRef.current.setRotationFromQuaternion(currentQuatRef.current);
    }
    if (issRef.current) {
      if (issTarget) {
        if (currentIssRef.current.length() === 0) {
          currentIssRef.current.copy(issTarget);
        } else {
          currentIssRef.current.lerp(issTarget, 0.04);
        }
        currentIssRef.current.setLength(ISS_RADIUS);
        issRef.current.position.copy(currentIssRef.current);
      }
      const scale = 0.85 + Math.sin(Date.now() * 0.004) * 0.25;
      issRef.current.scale.set(scale, scale, scale);
    }
  });

  const trailGeometries = useMemo(() => {
    if (visibleTrailPoints.length < 2) {
      return [] as THREE.TubeGeometry[];
    }

    const result: THREE.TubeGeometry[] = [];
    let currentSegment: THREE.Vector3[] = [toIssVector(visibleTrailPoints[0])];

    for (let i = 1; i < visibleTrailPoints.length; i += 1) {
      const prevPoint = visibleTrailPoints[i - 1];
      const nextPoint = visibleTrailPoints[i];
      const start = toIssVector(prevPoint);
      const end = toIssVector(nextPoint);

      if (nextPoint.ts - prevPoint.ts > ISS_TRAIL_SEGMENT_GAP_MS) {
        const geometry = buildTrailGeometry(currentSegment);
        if (geometry) {
          result.push(geometry);
        }
        currentSegment = [end];
        continue;
      }

      const arcPoints = interpolateArc(start, end);
      currentSegment.push(...arcPoints.slice(1));
    }

    const geometry = buildTrailGeometry(currentSegment);
    if (geometry) {
      result.push(geometry);
    }

    return result;
  }, [visibleTrailPoints]);

  return (
    <group ref={groupRef} scale={0.88}>
      <mesh>
        <sphereGeometry args={[size, 64, 48]} />
        <meshBasicMaterial
          map={earthTexture}
          color="rgba(95,95,95,0.7)"
          transparent
          opacity={0.42}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size, 64, 48]} />
        <meshBasicMaterial
          color="rgba(255,255,255,0.2)"
          wireframe
          transparent
          opacity={0.45}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 1.02, 64, 48]} />
        <meshBasicMaterial
          color="rgba(227,58,58,0.16)"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 1.06, 64, 48]} />
        <meshBasicMaterial
          color="rgba(120,120,120,0.12)"
          transparent
          opacity={0.18}
        />
      </mesh>
      {issPositions.length ? (
        <>
          {trailGeometries.map((geometry, index) => (
            <mesh key={`trail-${index}`} geometry={geometry}>
              <meshBasicMaterial color="rgba(80,160,255,0.75)" transparent opacity={0.8} />
            </mesh>
          ))}
          <mesh ref={issRef} position={issPositions[issPositions.length - 1]}>
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshBasicMaterial color="rgba(80,160,255,0.9)" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

export default function Globe3D() {
  const [issPoints, setIssPoints] = useState<IssPoint[]>([]);
  const [issTarget, setIssTarget] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchIss = async () => {
      try {
        const response = await fetch("/api/iss", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const lat = Number(payload?.iss_position?.latitude);
        const lon = Number(payload?.iss_position?.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          return;
        }
        const serverTrail = normalizeTrail(payload?.trail);
        const timestampSeconds = Number(payload?.timestamp);
        const pointTimestamp = Number.isFinite(timestampSeconds)
          ? timestampSeconds * 1000
          : Date.now();

        const radius = ISS_RADIUS;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const targetVector = new THREE.Vector3(x, y, z);
        if (!isMounted) {
          return;
        }
        setIssPoints((prev) => {
          const livePoint: IssPoint = { lat, lon, ts: pointTimestamp };
          return mergeTrails([prev, serverTrail, [livePoint]]);
        });
        setIssTarget(targetVector);
      } catch {
        // Ignore transient errors.
      }
    };

    fetchIss();
    const interval = setInterval(fetchIss, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto h-[clamp(16rem,78vw,22rem)] w-[clamp(16rem,78vw,22rem)] max-w-full overflow-visible">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 34 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.6} />
        <GlobeMesh size={1.0} issPoints={issPoints} issTarget={issTarget} />
      </Canvas>
    </div>
  );
}
