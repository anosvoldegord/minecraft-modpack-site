"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, useAnimations, useGLTF } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  AnimationAction,
  LoopOnce,
  Mesh,
  SRGBColorSpace,
  Group
} from "three";

type Props = {
  theme: string;
};

function ChestModel({ theme }: Props) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF("/gacha/chest_standard.glb");

  const model = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions["ANIMATION | Lid hinge pivotДействие"]
      ?? Object.values(actions).find(
        (candidate): candidate is AnimationAction => candidate != null
      );

    if (!action) {
      console.error("[GachaChest3D] GLB animation was not found.");
      return;
    }

    action.reset();
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setDuration(5);
    action.play();

    return () => {
      action.stop();
    };
  }, [actions]);

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y =
        Math.sin(clock.elapsedTime * 0.35) * 0.075;
    }
  });

  const accent =
    theme === "halloween"
      ? "#d66aff"
      : theme === "space"
        ? "#62e8d0"
        : "#ffc66b";

  return (
    <group ref={group}>
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#fff0d8", "#35213f", 1.15]} />

      <directionalLight
        position={[4, 7, 5]}
        intensity={3.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight
        position={[-4, 3, -3]}
        intensity={1.5}
        color={accent}
      />

      <pointLight
        position={[0, 1.8, 2.8]}
        intensity={2.2}
        distance={8}
        color={accent}
      />

      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

export default function GachaChest3D({ theme }: Props) {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [4, 2.8, 5.5], fov: 36 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <Suspense fallback={null}>
          <Bounds fit clip margin={1.35}>
            <ChestModel theme={theme} />
          </Bounds>
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/gacha/chest_standard.glb");