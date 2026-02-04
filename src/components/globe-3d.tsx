"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type GlobeMeshProps = {
  size?: number;
};

function GlobeMesh({ size = 1 }: GlobeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const earthTexture = useLoader(THREE.TextureLoader, "/textures/earth-bluemarble.png");
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = 8;
  earthTexture.minFilter = THREE.LinearMipmapLinearFilter;
  earthTexture.magFilter = THREE.LinearFilter;

  const grayscaleTexture = useMemo(() => {
    if (!earthTexture.image) {
      return earthTexture;
    }
    const image = earthTexture.image as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return earthTexture;
    }
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }, [earthTexture]);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
      groupRef.current.rotation.z = 0.24;
    }
  });

  return (
    <group ref={groupRef} scale={0.88}>
      <mesh>
        <sphereGeometry args={[size, 64, 48]} />
        <meshBasicMaterial
          map={grayscaleTexture}
          color="rgba(220,220,220,0.95)"
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size, 64, 48]} />
        <meshBasicMaterial
          color="rgba(255,255,255,0.35)"
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 1.02, 64, 48]} />
        <meshBasicMaterial
          color="rgba(227,58,58,0.4)"
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 1.06, 64, 48]} />
        <meshBasicMaterial
          color="rgba(53,242,139,0.12)"
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

export default function Globe3D() {
  return (
    <div className="h-72 w-72">
      <Canvas
        camera={{ position: [0, 0, 3.0], fov: 34 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.6} />
        <GlobeMesh size={1.05} />
      </Canvas>
    </div>
  );
}
