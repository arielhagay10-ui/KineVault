"use client";

export function StudioProp({ slug }: { slug: "stool" | "plyo-box" }) {
  if (slug === "plyo-box") return <mesh position={[0, .25, 0]} castShadow receiveShadow><boxGeometry args={[.6, .5, .75]} /><meshStandardMaterial color="#243439" roughness={.85} /></mesh>;
  return <group>
    <mesh position={[0, .555, 0]} castShadow receiveShadow><boxGeometry args={[.46, .09, .46]} /><meshStandardMaterial color="#18282b" roughness={.85} /></mesh>
    {[-.2, .2].flatMap(x => [-.2, .2].map(z => <mesh key={`${x}:${z}`} position={[x, .25, z]} castShadow><boxGeometry args={[.045, .5, .045]} /><meshStandardMaterial color="#697d83" metalness={.65} roughness={.34} /></mesh>))}
  </group>;
}
