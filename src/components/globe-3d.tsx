"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type GlobeMeshProps = {
  size?: number;
  issPositions: THREE.Vector3[];
  issTarget: THREE.Vector3 | null;
};

type IssPoint = {
  lat: number;
  lon: number;
  ts: number;
};

const ISS_TRAIL_WINDOW_MS = 30 * 60 * 1000;
const ISS_RADIUS = 1.18;

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

function mergeTrails(now: number, trailGroups: IssPoint[][]): IssPoint[] {
  const deduped = new Map<string, IssPoint>();

  for (const group of trailGroups) {
    for (const point of group) {
      deduped.set(buildTrailKey(point), point);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.ts - b.ts)
    .filter((point) => now - point.ts <= ISS_TRAIL_WINDOW_MS);
}

function GlobeMesh({ size = 1, issPositions, issTarget }: GlobeMeshProps) {
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

  const trailGeometry = useMemo(() => {
    if (issPositions.length < 2) {
      return null;
    }
    const curve = new THREE.CatmullRomCurve3(issPositions);
    return new THREE.TubeGeometry(curve, 120, 0.012, 8, false);
  }, [issPositions]);

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
          {trailGeometry ? (
            <mesh geometry={trailGeometry}>
              <meshBasicMaterial color="rgba(80,160,255,0.75)" transparent opacity={0.8} />
            </mesh>
          ) : null}
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

  const issVectors = useMemo(() => {
    return issPoints.map((point) => {
      const radius = ISS_RADIUS;
      const phi = (90 - point.lat) * (Math.PI / 180);
      const theta = (point.lon + 180) * (Math.PI / 180);
      const x = -radius * Math.sin(phi) * Math.cos(theta);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    });
  }, [issPoints]);

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
          const now = Date.now();
          const livePoint: IssPoint = { lat, lon, ts: pointTimestamp };
          return mergeTrails(now, [prev, serverTrail, [livePoint]]);
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
        <GlobeMesh size={1.0} issPositions={issVectors} issTarget={issTarget} />
      </Canvas>
    </div>
  );
}
