"""Original KineVault teaching model. Run with Blender --background --python this_file.

No external meshes, textures or add-ons. Inputs use the authoritative solver's
metre / Y-up coordinates; GLTF export handles Blender's Z-up conversion.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/models/equipment"
EVIDENCE = ROOT / ".local-artifacts/visual-pilot/after/equipment"
OUTPUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def xyz(point):
    return Vector((point[0], -point[2], point[1]))


def material(name, color, metallic, roughness):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return result


materials = {
    "frame": material("Powder coated slate", (.20, .27, .28), .65, .34),
    "chrome": material("Satin stainless steel", (.58, .65, .67), .91, .23),
    "rubber": material("Textured charcoal rubber", (.024, .034, .036), .02, .83),
    "pad": material("Charcoal upholstery", (.055, .075, .078), .0, .64),
    "stack": material("Cast iron plates", (.085, .105, .11), .5, .52),
    "accent": material("Adjustment marker", (.57, .45, .20), .35, .47),
}
groups = {}
parts = {}
for name in ("Static", "Weights", "Handles"):
    group = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(group)
    groups[name] = group
    parts[name] = {}


def finish(obj, name, mat, group):
    obj.name = name
    obj.data.materials.append(materials[mat])
    obj.parent = groups[group]
    parts[group].setdefault(mat, []).append(obj)
    return obj


def box(name, at, size, mat="frame", bevel=.018, group="Static"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(at))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return finish(obj, name, mat, group)


def tube(name, a, b, radius, mat="chrome", group="Static", vertices=20):
    start, end = xyz(a), xyz(b)
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    modifier = obj.modifiers.new("Soft machined rim", "BEVEL")
    modifier.width = min(.006, radius * .14)
    modifier.segments = 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat, group)


def frame(name, a, b, width=.095, depth=.095):
    center = (Vector(a) + Vector(b)) / 2
    delta = xyz(b) - xyz(a)
    obj = box(name, center, (width, delta.length, depth), bevel=.015)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    return obj


# Stable base and rear frame remain exactly at the existing support coordinates.
for side in (-1, 1):
    x = side * .5
    box("Base runner", (x, .071, .015), (.12, .11, 1.49))
    for z in (-.73, .76):
        box("Rubber floor shoe", (x, .042, z), (.19, .084, .22), "rubber", .025)
    frame("Rear upright", (side * .43, .12, -.55), (side * .43, 2.75, -.55), .11, .12)
    frame("Overhead arm", (side * .43, 2.75, -.55), (side * .43, 2.75, .25), .095, .095)
    frame("Base brace", (side * .43, .18, -.55), (side * .43, .52, -.27), .07, .07)
    box("Stack side guard", (side * .325, 1.24, -.565), (.08, 2.08, .28), "frame", .025)
    tube("Weight guide", (side * .18, .16, -.52), (side * .18, 2.55, -.52), .014)
    for y in (.2, 2.6):
        tube("Frame fastener", (side * .43, y, -.478), (side * .43, y, -.462), .023, "chrome", vertices=6)

frame("Top rear crossmember", (-.43, 2.75, -.55), (.43, 2.75, -.55))
frame("Pulley crossmember", (-.43, 2.75, .22), (.43, 2.75, .22), .075, .085)
box("Rear stack enclosure", (0, 1.23, -.70), (.62, 2.08, .045), "frame", .025)
box("Stack lower plinth", (0, .16, -.52), (.59, .08, .32), "rubber", .015)
for i in range(10):
    box("Moving weight plate", (0, .24 + i * .063, -.52), (.46, .05, .24), "stack", .009, "Weights")
    box("Plate marker", (.252, .24 + i * .063, -.4), (.015, .012, .008), "chrome", .002, "Weights")
tube("Selector pin", (.17, .493, -.377), (.245, .493, -.377), .012, "accent", "Weights", vertices=12)
tube("Stack cable anchor", (0, .82, -.52), (0, .86, -.52), .019, "chrome", "Weights")

# Solver seat top remains .805, thigh roller axis .88 and radius .085.
frame("Central base rail", (0, .12, -.55), (0, .12, .6))
for z in (-.55, 0, .5):
    frame("Base crossmember", (-.5, .12, z), (.5, .12, z))
frame("Seat pedestal", (0, .12, 0), (0, .66, 0), .105, .105)
box("Seat underside", (0, .673, 0), (.43, .045, .37), "frame", .025)
box("Rounded seat cushion", (0, .74, 0), (.52, .13, .44), "pad", .058)
frame("Thigh support pedestal", (0, .12, .5), (0, .84, .5), .07, .07)
tube("Thigh pad spindle", (-.37, .88, .49), (.37, .88, .49), .024)
for side in (-1, 1):
    tube("Thigh bolster", (side * .045, .88, .49), (side * .36, .88, .49), .085, "pad", vertices=32)
    tube("Pad end cap", (side * .36, .88, .49), (side * .376, .88, .49), .063, "rubber")
for y in (.42, .48, .54, .6):
    tube("Seat adjustment hole", (-.054, y, .001), (-.057, y, .001), .007, "rubber", vertices=12)
tube("Seat adjustment knob", (.054, .47, .002), (.105, .47, .002), .022, "accent")

# Axles, flanges and exposed sheaves explain the cable path. Cables stay runtime-owned.
for z in (-.55, .22):
    tube("Pulley sheave", (-.023, 2.75, z), (.023, 2.75, z), .09, "rubber", vertices=32)
    for x in (-.032, .032):
        tube("Pulley flange", (x - .004, 2.75, z), (x + .004, 2.75, z), .098, "frame", vertices=32)
    tube("Pulley axle", (-.055, 2.75, z), (.055, 2.75, z), .023, "chrome", vertices=16)

tube("Pulldown bar", (-.48, 0, 0), (.48, 0, 0), .023, "chrome", "Handles", vertices=28)
for side in (-1, 1):
    tube("Angled bar grip", (side * .48, 0, 0), (side * .72, -.1, 0), .025, "rubber", "Handles", vertices=24)
    tube("Grip collar", (side * .47, 0, 0), (side * .49, -.004, 0), .03, "chrome", "Handles")
    tube("Grip end cap", (side * .71, -.096, 0), (side * .726, -.1025, 0), .029, "rubber", "Handles")
tube("Bar cable eye", (0, 0, 0), (0, .07, 0), .014, "chrome", "Handles")

# Merge by semantic group and material: few draw calls, independent moving roots.
for group, bins in parts.items():
    for mat, objects in bins.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f"{group}_{mat}"
        # Bake transforms, retain semantic group's zero origin for runtime motion.
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

bpy.ops.export_scene.gltf(filepath=str(OUTPUT / "lat-pulldown.v1.glb"), export_format="GLB", export_yup=True, export_animations=False, export_cameras=False, export_lights=False, export_extras=False)
stats = {"blender": bpy.app.version_string, "groups": list(groups), "meshes": len([o for o in bpy.data.objects if o.type == "MESH"]), "triangles": sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == "MESH" for p in o.data.polygons), "bytes": (OUTPUT / "lat-pulldown.v1.glb").stat().st_size}
(EVIDENCE / "blender-export.json").write_text(json.dumps(stats, indent=2))
print(json.dumps(stats))
