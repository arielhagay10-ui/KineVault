import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3 } from "three";

// Original adjustable gym bench, in the same world units as the anatomy rig.
export function createAdjustableBench(angleDegrees = 45) {
  const angle = Math.max(0, Math.min(85, angleDegrees)) * Math.PI / 180;
  const along = (distance: number): [number, number, number] => [0, 0.63 + distance * Math.sin(angle), 0.2 - distance * Math.cos(angle)];
  const root = new Group();
  const steel = new MeshStandardMaterial({ color: "#d1d7d7", metalness: 0.65, roughness: 0.32 });
  const pad = new MeshStandardMaterial({ color: "#202526", roughness: 0.86 });
  const rubber = new MeshStandardMaterial({ color: "#101718", roughness: 0.95 });
  const hardware = new MeshStandardMaterial({ color: "#718082", metalness: 0.8, roughness: 0.25 });
  function box(size: [number, number, number], at: [number, number, number], material = steel) {
    const mesh = new Mesh(new BoxGeometry(...size), material);
    mesh.position.fromArray(at); mesh.castShadow = true; root.add(mesh); return mesh;
  }
  function beam(from: [number, number, number], to: [number, number, number], width = 0.075) {
    const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
    const mesh = box([width, direction.length(), width], [0, 0, 0]);
    mesh.position.copy(a.add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  }
  function cushion(width: number, length: number) {
    const x = width / 2, radius = 0.04, shape = new Shape();
    shape.moveTo(-x + radius, 0); shape.lineTo(x - radius, 0);
    shape.quadraticCurveTo(x, 0, x, radius); shape.lineTo(x, length - radius);
    shape.quadraticCurveTo(x, length, x - radius, length); shape.lineTo(-x + radius, length);
    shape.quadraticCurveTo(-x, length, -x, length - radius); shape.lineTo(-x, radius);
    shape.quadraticCurveTo(-x, 0, -x + radius, 0);
    const geometry = new ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.009, bevelThickness: 0.009, curveSegments: 8 });
    geometry.translate(0, 0, -0.045);
    const mesh = new Mesh(geometry, pad); mesh.castShadow = true; root.add(mesh); return mesh;
  }
  const backrest = cushion(0.44, 1.62);
  backrest.name = "incline-backrest"; backrest.position.set(0, 0.673, 0.253); backrest.rotation.x = angle - Math.PI / 2;
  const seat = cushion(0.46, 0.47);
  seat.name = "bench-seat"; seat.position.set(0, 0.65, 0.78); seat.rotation.x = -Math.PI / 2;
  // Two stable T feet with rubber end caps and a sloping central frame.
  for (const z of [-0.78, 0.68]) {
    box([0.72, 0.075, 0.085], [0, 0.045, z]);
    for (const x of [-0.34, 0.34]) box([0.09, 0.09, 0.12], [x, 0.045, z], rubber);
  }
  beam([0, 0.12, -0.78], [0, 0.59, 0.6], 0.1);
  beam([0, 0.08, 0.68], [0, 0.6, 0.58], 0.1);
  beam([0, 0.55, 0.59], [0, 0.59, 0.3], 0.065);
  // Backrest spine, hinged near the seat, and load-bearing adjustment strut.
  beam([0, 0.63, 0.2], along(1.57), 0.07);
  beam([0, 0.28, -0.5], along(0.92), 0.07);
  for (const x of [-0.075, 0.075]) beam([x, 0.21, -0.62], [x, 0.49, -0.1], 0.028);
  for (let i = 0; i < 6; i++) box([0.19, 0.02, 0.025], [0, 0.23 + i * 0.045, -0.58 + i * 0.085], hardware);
  for (const [y, z] of [[0.63, 0.27], [0.29, -0.5], along(0.92).slice(1)]) {
    const pivot = new Mesh(new CylinderGeometry(0.038, 0.038, 0.19, 20), hardware);
    pivot.rotation.z = Math.PI / 2; pivot.position.set(0, y, z); root.add(pivot);
  }
  return { root, backrest, seat, dispose() {
    root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    for (const material of [steel, pad, rubber, hardware]) material.dispose();
  } };
}
