"""Build original KineVault equipment meshes with Blender 4.5.

Coordinates are the workshop solver's metre/Y-up coordinates. No external
meshes, textures, people, or add-ons are used. Website cables stay dynamic.
"""
import bpy
import argparse
import json
import math
import sys
from pathlib import Path
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/models/equipment"
EVIDENCE = ROOT / ".local-artifacts/visual-rollout/equipment"
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)


def xyz(p):
    return Vector((p[0], -p[2], p[1]))


def new_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)
    palette = {
        "frame": ((.20, .27, .28), .65, .34),
        "chrome": ((.58, .65, .67), .9, .25),
        "rubber": ((.025, .034, .036), .02, .82),
        "pad": ((.055, .075, .078), 0, .65),
        "iron": ((.085, .105, .11), .5, .53),
        "accent": ((.57, .45, .20), .35, .47),
        "band": ((.28, .37, .17), 0, .62),
        "row-arm": ((.46, .075, .045), .5, .36),
    }
    global mats, groups
    mats, groups = {}, {}
    for name, (color, metal, rough) in palette.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*color, 1)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
        mats[name] = mat


def group(name):
    if name not in groups:
        item = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(item)
        groups[name] = item
    return groups[name]


def finish(name, obj, material, parent):
    obj.name = name
    obj.data.materials.append(mats[material])
    obj.parent = group(parent)
    return obj


def box(name, at, size, material="frame", parent="Static", bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(at))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Machined edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(name, obj, material, parent)


def tube(name, a, b, radius=.025, material="chrome", parent="Static", sides=16):
    start, end = xyz(a), xyz(b)
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=delta.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return finish(name, obj, material, parent)


def beam(name, a, b, size=.08, material="frame", parent="Static"):
    start, end = xyz(a), xyz(b)
    delta = end - start
    obj = box(name, (0, 0, 0), (size, delta.length, size), material, parent)
    obj.location = (start + end) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    return obj


def feet(width, front, back):
    for x in (-width, width):
        box("Base runner", (x, .07, (front + back) / 2), (.11, .12, front - back))
        for z in (front, back):
            box("Floor shoe", (x, .045, z), (.19, .09, .19), "rubber")
    beam("Base crossmember", (-width, .1, back + .18), (width, .1, back + .18))


def weight_stack(x, z, bottom, travel):
    for side in (-1, 1):
        tube("Weight guide", (x + side * .17, .16, z), (x + side * .17, 2.49, z), .014)
    for i in range(10):
        box("Moving stack plate", (x, bottom + i * .063, z), (.45, .048, .23), "iron", "Weights", .005)
    tube("Selector pin", (x + .16, bottom + .24, z + .12), (x + .27, bottom + .24, z + .12), .011, "accent", "Weights")


def machine(name):
    new_scene()
    for part in ("Static", "Weights", "Handles"):
        group(part)
    if name == "smith-machine":
        feet(1.02, .7, -.7)
        for side in (-1, 1):
            x = side * 1.02
            beam("Frame upright", (x, .1, -.4), (x, 3.25, -.4), .12)
            tube("Bar guide", (side * .83, .16, -.12), (side * .83, 3.13, -.12), .021)
            for y in (.16, 3.13):
                beam("Guide bearing mount", (x, y, -.4), (side * .83, y, -.12), .065)
            for i in range(13):
                box("Safety catch", (side * .96, .48 + i * .14, -.25), (.08, .035, .15), "chrome")
            for y in (.45, .8):
                tube("Plate peg", (x, y, -.4), (side * 1.26, y, -.4), .023)
            box("Bar carriage", (side * .83, 0, 0), (.13, .1, .18), "iron", "Handles")
            for px in (1.15, 1.23):
                tube("Loaded plate", (side * px, 0, 0), (side * (px + .055), 0, 0), .2, "iron", "Handles", 32)
        beam("Top crossmember", (-1.02, 3.25, -.4), (1.02, 3.25, -.4), .11)
        tube("Moving bar", (-1.4, 0, 0), (1.4, 0, 0), .025, "chrome", "Handles")
        for x in (-.56, .56):
            tube("Knurled grip", (x - .12, 0, 0), (x + .12, 0, 0), .028, "rubber", "Handles")
    elif name == "row-machine":
        feet(.70, 1.14, -.83)
        group("Seat")
        beam("Seat pedestal", (0, .10, -.17), (0, .49, -.17), .115)
        beam("Seat sliding post", (0, .40, -.17), (0, .60, -.17), .075, "chrome", "Seat")
        box("Adjustable seat", (0, .605, -.17), (.48, .11, .50), "pad", "Seat", .035)
        tube("Seat adjustment pin", (.05, .44, -.17), (.16, .44, -.17), .018, "accent")
        beam("Seat base tie", (-.70, .10, -.17), (.70, .10, -.17))
        beam("Chest pad column", (0, .10, .42), (0, 1.29, .37), .085)
        beam("Chest pad bracket", (0, 1.29, .37), (0, 1.29, .168), .075)
        box("Chest pad", (0, 1.29, .168), (.34, .45, .14), "pad", bevel=.04)
        for x in (-.25, .25):
            box("Foot platform", (x, .17, .55), (.28, .06, .40), "rubber", bevel=.014)
            bpy.context.object.rotation_euler[0] = math.radians(-12)
            beam("Foot platform support", (x, .08, .40), (x, .165, .68), .055)
        for side, parent in ((1, "LeftLever"), (-1, "RightLever")):
            x = side * .55
            beam("Bearing tower", (x, .10, .98), (x, .62, .55), .11)
            beam("Bearing tie", (side * .70, .10, .98), (0, .10, .98))
            tube("Bearing housing", (x - .06, .62, .55), (x + .06, .62, .55), .085, "iron", sides=24)
            group(parent)
            beam("Independent row arm", (0, 0, 0), (0, .76, .12), .105, "row-arm", parent)
            tube("Handle bracket", (0, .76, .12), (-side * .25, .80, .08), .025, "chrome", parent)
            tube("Neutral grip", (-side * .25, .67, .08), (-side * .25, .91, .08), .026, "rubber", parent)
            tube("Upper grip upright", (0, .76, .12), (side * .10, .94, .02), .025, "chrome", parent)
            tube("Upper back grip", (-side * .25, .94, .02), (side * .10, .94, .02), .026, "rubber", parent)
            tube("Outside handle return", (side * .10, .94, .02), (side * .17, .83, .02), .025, "chrome", parent)
            beam("Loading arm", (0, 0, 0), (0, -.11, .42), .13, "row-arm", parent)
            tube("Load horn", (0, -.11, .42), (side * .46, -.11, .42), .026, "chrome", parent)
            for offset in (.15, .21):
                tube("Load plate", (side * offset, -.11, .42), (side * (offset + .045), -.11, .42), .22, "iron", parent, 32)
            tube("Pivot axle", (-.07, 0, 0), (.07, 0, 0), .045, "chrome", parent)
    elif name == "shoulder-press-machine":
        source = (ROOT / "src/lib/motion/shoulder-press.ts").read_text()
        press = json.loads(source.split("export const shoulderPress = ", 1)[1].split(" as const;", 1)[0])
        mats["frame"] = mats["chrome"]
        for key, color in (("pad", (.008, .010, .012)), ("rubber", (.005, .006, .007)), ("iron", (.018, .022, .025))):
            mats[key].diffuse_color = (*color, 1)
            mats[key].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1)
        base, seat, back = press["base"], press["seat"], press["back"]
        feet(base["width"], base["front"], base["back"])
        box("Seat", seat["center"], seat["size"], "pad", bevel=.035)
        beam("Seat pedestal", (0, .1, 0), (0, .51, 0), .1)
        beam("Seat bearer", (0, .5, -.30), (0, .5, .24), .085)
        beam("Seat base tie", (-base["width"], .1, 0), (base["width"], .1, 0))
        box("Back pad", back["center"], back["size"], "pad", bevel=.04)
        bpy.context.object.rotation_euler[0] = math.radians(back["degrees"])
        beam("Backrest spine", (0, .1, -.31), (0, 1.76, -.37), .09)
        beam("Back pad bracket", (0, 1.22, -.35), (0, 1.22, -.28), .07)
        beam("Rear brace", (0, .1, -.65), (0, 1.2, -.32), .075)
        for side, parent in ((1, "LeftLever"), (-1, "RightLever")):
            pivot = (side * press["pivot"]["x"], press["pivot"]["y"], press["pivot"]["z"])
            axis = Vector((1, side * press["axisSlope"], 0)).normalized()
            beam("Pivot upright", (side * base["width"], .1, -.54), pivot, .09)
            beam("Pivot base tie", (side * base["width"], .1, -.54), (0, .1, -.54))
            tube("Bearing", Vector(pivot) - axis * .06, Vector(pivot) + axis * .06, .075, "iron", sides=24)
            group(parent)
            beam("Lever arm", (0, 0, 0), press["arm"], .08, parent=parent)
            wide, neutral = press["wide"], press["neutral"]
            wx, wy, wz = wide["center"]
            nx, ny, nz = neutral["center"]
            swivel_name = "LeftNeutralGrip" if side == 1 else "RightNeutralGrip"
            swivel = group(swivel_name)
            swivel.parent = group(parent)
            swivel.location = xyz((0, wy, wz))
            tube("Handle bearing", -axis * .05, axis * .05, .04, "chrome", swivel_name)
            handle_dx = wide["halfLength"] * math.cos(math.radians(wide["degrees"]))
            handle_dy = side * wide["halfLength"] * math.sin(math.radians(wide["degrees"]))
            tube("Wide pronated grip", (side * wx - handle_dx, -handle_dy, 0), (side * wx + handle_dx, handle_dy, 0), .026, "rubber", swivel_name)
            tube("Neutral grip", (side * nx, ny - wy, nz - wz - neutral["halfLength"]), (side * nx, ny - wy, nz - wz + neutral["halfLength"]), .026, "rubber", swivel_name)
            load = (0, press["load"]["y"], press["load"]["z"])
            beam("Loading arm", (0, 0, 0), load, .08, parent=parent)
            tube("Load horn", load, (side * press["load"]["hornLength"], load[1], load[2]), .025, "chrome", parent)
            for offset in (.12, .18):
                tube("Load plate", (side * offset, load[1], load[2]), (side * (offset + .045), load[1], load[2]), press["load"]["radius"], "iron", parent, 24)
            tube("Pivot axle", -axis * .055, axis * .055, .04, "chrome", parent)
    elif name == "leg-press":
        source = (ROOT / "src/lib/motion/leg-press.ts").read_text()
        press = json.loads(source.split("export const legPress = ", 1)[1].split(" as const;", 1)[0])
        back_y, back_z = press["back"]["center"][1] - 1, press["back"]["center"][2] + .98
        feet(.64, 1.05, -1.25)
        for side in (-1, 1):
            x = side * .64
            beam("Inclined guide", (x, .64, -.24), (x, 1.85, .97), .075)
            beam("Front upright", (x, .1, .97), (x, 1.85, .97), .09)
            beam("Rear guide upright", (x, .1, -.24), (x, .64, -.24), .09)
            tube("Guide rail", (x, .64, -.24), (x, 1.85, .97), .02)
            box("Sled carriage", (x, 0, 0), (.13, .19, .23), "iron", "Handles")
        beam("Top brace", (-.64, 1.85, .97), (.64, 1.85, .97))
        box("Seat cushion", (0, .52, -.48), (.56, .14, .48), "pad")
        back = box("Inclined back support", tuple(press["back"]["center"]), tuple(press["back"]["size"]), "pad")
        back.rotation_euler[0] = math.radians(press["back"]["degrees"])
        beam("Seat pedestal", (0, .1, -.48), (0, .44, -.48), .1)
        beam("Seat bearer", (0, .43, -.72), (0, .43, -.24), .09)
        beam("Backrest spine", (0, .54 + back_y, -.52 + back_z), (0, 1.35 + back_y, -1.33 + back_z), .09)
        beam("Rear backrest leg", (0, .1, -1.07), (0, .93 + back_y, -1.05 + back_z), .09)
        beam("Backrest tie", (0, .93 + back_y, -1.05 + back_z), (0, .93 + back_y, -.91 + back_z), .09)
        beam("Rear seat crossmember", (-.64, .1, -1.07), (.64, .1, -1.07))
        beam("Seat crossmember", (-.64, .1, -.48), (.64, .1, -.48))
        sled = box("Foot sled", tuple(press["plateCenter"]), tuple(press["plateSize"]), "frame", "Handles")
        sled.rotation_euler[0] = math.radians(press["plateDegrees"])
        tube("Plate axle", (-1.05, .08, .08), (1.05, .08, .08), .027, "chrome", "Handles")
        beam("Sled crossmember", (-.64, .04, .04), (.64, .04, .04), .075, parent="Handles")
        for x in (-.87, -.95, .87, .95):
            tube("Sled plate", (x - .03, .08, .08), (x + .03, .08, .08), .2, "iron", "Handles", 32)
    elif name == "cable-row-machine":
        feet(.46, 1.75, -.85)
        box("Seat", (0, .612, -.22), (.5, .13, 1.05), "pad")
        for z in (-.5, .12):
            beam("Seat pedestal", (0, .1, z), (0, .53, z), .09)
            beam("Seat base tie", (-.46, .1, z), (.46, .1, z))
        beam("Seat bearer", (0, .52, -.7), (0, .52, .27), .085)
        for x in (-.17, .17):
            foot = box("Footplate", (x, .24, 1.12), (.25, .05, .5), "frame")
            foot.rotation_euler[0] = -math.pi / 4
            beam("Footplate standoff", (x, .1, 1.12), (x, .24, 1.12), .06)
        beam("Footplate base tie", (-.46, .1, 1.12), (.46, .1, 1.12))
        for x in (-.32, .32):
            beam("Tower upright", (x, .1, 1.6), (x, 2.4, 1.6), .09)
        beam("Tower head", (-.32, 2.4, 1.6), (.32, 2.4, 1.6), .09)
        beam("Tower base tie", (-.46, .1, 1.6), (.46, .1, 1.6))
        weight_stack(0, 1.6, .2, .66)
        for z, y in ((1.6, 2.4), (1.35, 1.23)):
            tube("Pulley", (-.025, y, z), (.025, y, z), .075, "rubber", sides=32)
        for side in (-1, 1):
            x = side * .15
            tube("Row grip", (x, -.14, 0), (x, .14, 0), .024, "rubber", "Handles")
            tube("Handle yoke", (x, -.14, 0), (0, 0, .08), .017, "chrome", "Handles")
    elif name == "pec-deck":
        feet(.56, .85, -1.4)
        box("Seat", (0, .59, 0), (.52, .13, .44), "pad")
        box("Back support", (0, 1.3, -.2), (.49, 1.05, .14), "pad")
        beam("Seat pedestal", (0, .1, 0), (0, .51, 0), .1)
        beam("Seat base tie", (-.56, .1, 0), (.56, .1, 0))
        beam("Seat bearer", (0, .5, -.22), (0, .5, .22), .09)
        beam("Backrest upright", (0, .1, -.3), (0, 1.8, -.3), .09)
        beam("Backrest base tie", (0, .1, -1.22), (0, .1, 0))
        for x in (-.38, .38):
            beam("Rear upright", (x, .1, -1.32), (x, 2.62, -1.32), .1)
            beam("Overhead pivot support", (x, 2.62, -1.32), (math.copysign(.289, x), 2.7, .136), .075)
        beam("Rear head", (-.38, 2.62, -1.32), (.38, 2.62, -1.32), .08)
        beam("Tower base tie", (-.56, .1, -1.32), (.56, .1, -1.32))
        weight_stack(0, -1.32, .2, .4)
        for side, parent in ((1, "LeftArm"), (-1, "RightArm")):
            group(parent)
            tube("Moving lever", (0, 0, 0), (0, -.69, .955), .035, "frame", parent)
            tube("Handle stem", (0, -.69, .955), (0, -.86, .955), .028, "chrome", parent)
            tube("Vertical grip", (0, -.86, .955), (0, -1.27, .955), .024, "rubber", parent)
            tube("Pivot housing", (0, 0, 0), (0, .16, 0), .12, "iron", parent)
    else:
        raise ValueError(name)
    export(name)


def static(name):
    new_scene()
    group("Static")
    if name == "stool":
        box("Seat cushion", (0, .555, 0), (.46, .09, .46), "pad", bevel=.045)
        box("Seat tray", (0, .494, 0), (.42, .035, .42), "frame", bevel=.02)
        for x in (-1, 1):
            for z in (-1, 1):
                beam("Splayed leg", (x * .24, .04, z * .24), (x * .16, .49, z * .16), .045)
                box("Rubber shoe", (x * .24, .025, z * .24), (.075, .05, .075), "rubber")
            beam("Foot brace", (x * .21, .23, -.21), (x * .21, .23, .21), .025)
        for z in (-.21, .21):
            beam("Foot brace", (-.21, .23, z), (.21, .23, z), .025)
    elif name == "plyo-box":
        box("Box core", (0, .25, 0), (.6, .5, .75), "pad", bevel=.025)
        box("Non-slip top", (0, .499, 0), (.57, .012, .72), "rubber", bevel=.006)
        for x in (-.29, .29):
            for z in (-.365, .365):
                box("Corner protector", (x, .25, z), (.024, .46, .024), "frame", bevel=.005)
        for x in (-.301, .301):
            box("Recessed carry grip", (x, .3, 0), (.008, .065, .18), "rubber", bevel=.02)
            box("Carry grip rim", (x, .345, 0), (.012, .014, .2), "frame", bevel=.005)
        for z in (-.376, .376):
            for i in range(3):
                box("Height mark", (-.2 + i * .024, .08, z), (.009, .035, .004), "accent", bevel=0)
    elif name == "resistance-band":
        vertices, faces = [], []
        for i in range(64):
            angle = 2 * math.pi * i / 64
            for radial, height in ((-.012, -.002), (.012, -.002), (.012, .002), (-.012, .002)):
                vertices.append(tuple(xyz((.35 + (.35 + radial) * math.cos(angle), .025 + height, (.11 + radial) * math.sin(angle)))))
        for i in range(64):
            for corner in range(4):
                faces.append((i * 4 + corner, ((i + 1) % 64) * 4 + corner, ((i + 1) % 64) * 4 + (corner + 1) % 4, i * 4 + (corner + 1) % 4))
        mesh = bpy.data.meshes.new("Continuous loop")
        mesh.from_pydata(vertices, [], faces)
        obj = bpy.data.objects.new("Loop band", mesh)
        bpy.context.collection.objects.link(obj)
        finish("Loop band", obj, "band", "Static")
    elif name == "cable-machine":
        feet(.37, .4, -.4)
        beam("Tower base tie", (-.37, .12, 0), (.37, .12, 0))
        beam("Tower", (0, .14, 0), (0, 3.35, 0), .13)
        for y in (.22, 3.22):
            box("Tower housing", (0, y, 0), (.31, .19, .28))
        for i in range(9):
            box("Stack plate", (0, .22 + i * .065, -.17), (.4, .05, .3), "iron")
        for side in (-1, 1):
            tube("Stack guide", (side * .16, .14, -.17), (side * .16, 3.08, -.17), .013)
        group("Pulley")
        tube("Adjustable pulley", (-.035, 0, .2), (.035, 0, .2), .09, "rubber", "Pulley", 32)
        tube("Pulley axle", (-.055, 0, .2), (.055, 0, .2), .018, "chrome", "Pulley")
        box("Pulley carriage", (0, 0, .09), (.15, .2, .22), "frame", "Pulley")
    elif name == "bench":
        for z in (-.78, .68):
            box("T foot", (0, .045, z), (.72, .075, .085))
            for x in (-.34, .34):
                box("Floor cap", (x, .045, z), (.09, .09, .12), "rubber")
        beam("Main spine", (0, .12, -.78), (0, .59, .6), .1)
        beam("Front leg", (0, .08, .68), (0, .59, .6), .1)
        beam("Seat bearer", (0, .59, .27), (0, .59, .76), .075)
        box("Seat", (0, .65, .55), (.46, .09, .47), "pad")
        tube("Incline hinge", (-.1, .673, .253), (.1, .673, .253), .035)
        group("Back")
        box("Back cushion", (0, 0, -.81), (.44, .09, 1.62), "pad", "Back", .03)
        beam("Back support", (0, -.08, -.06), (0, -.08, -1.52), .065, "frame", "Back")
        # Unit-length local Y brace; the renderer joins its base to the backrest.
        group("Brace")
        box("Incline brace", (0, .5, 0), (.06, 1, .06), "frame", "Brace")
        beam("Adjustment rail", (0, .22, -.62), (0, .43, -.05), .07)
        tube("Brace pivot", (-.095, .28, -.5), (.095, .28, -.5), .032)
        for i in range(6):
            box("Adjustment notch", (0, .23 + i * .035, -.6 + i * .095), (.17, .025, .035), "chrome")
    elif name == "squat-rack":
        feet(.65, .6, -.8)
        for x in (-.65, .65):
            beam("Rack post", (x, .04, -.3), (x, 2.3, -.3), .09)
            beam("Safety rail", (x, 1.4, -.3), (x, 1.4, .5), .05)
            for i in range(10):
                box("J hook", (x, .65 + i * .15, -.22), (.09, .025, .12), "chrome")
        beam("Top brace", (-.65, 2.3, -.3), (.65, 2.3, -.3))
    elif name in ("barbell", "dumbbell"):
        half = .8 if name == "barbell" else .14
        radius = .2 if name == "barbell" else .1
        tube("Shaft", (-half - .08, .2, 0), (half + .08, .2, 0), .025)
        for side in (-1, 1):
            x = side * half
            tube("Plate", (x - .04, .2, 0), (x + .04, .2, 0), radius, "iron", sides=32)
            tube("Collar", (x - side * .07, .2, 0), (x - side * .04, .2, 0), .045)
        tube("Knurled center", (-min(half, .28), .2, 0), (min(half, .28), .2, 0), .027, "rubber")
    elif name == "kettlebell":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=.17, location=xyz((0, -.08, 0)))
        bell = bpy.context.object
        for face in bell.data.polygons:
            face.use_smooth = True
        finish("Cast iron bell", bell, "iron", "Static")
        tube("Top handle", (-.16, .2, 0), (.16, .2, 0), .023, "rubber")
        for side in (-1, 1):
            tube("Handle stem", (side * .16, .2, 0), (side * .112, -.02, 0), .024, "frame")
    else:
        raise ValueError(name)
    export(name)


def attachment(name):
    new_scene()
    group("Static")
    prefix = "attachment-" + name
    if name == "d-handle":
        tube("Grip", (-.1, 0, 0), (.1, 0, 0), .025, "rubber")
        for x in (-.1, .1):
            tube("Bow arm", (x, 0, 0), (x, .14, 0), .012)
        tube("Bow", (-.1, .14, 0), (.1, .14, 0), .012)
        tube("Eye", (0, .14, 0), (0, .21, 0), .013)
    elif name == "rope":
        tube("Rope grip", (-.09, 0, 0), (.09, 0, 0), .018, "rubber")
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=.04, location=xyz((.11, 0, 0)))
        finish("Rope stopper", bpy.context.object, "iron", "Static")
    elif name == "cuff":
        bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=10, location=(0, 0, 0), major_radius=1, minor_radius=.16)
        for face in bpy.context.object.data.polygons:
            face.use_smooth = True
        finish("Padded cuff", bpy.context.object, "pad", "Static")
    else:
        points = {
            "straight-bar": [(-.34, 0, 0), (.34, 0, 0)],
            "angled-bar": [(-.34, -.124, 0), (0, 0, 0), (.34, -.124, 0)],
            "lat-bar": [(-.62, -.16, 0), (-.38, 0, 0), (.38, 0, 0), (.62, -.16, 0)],
            "v-bar": [(-.2, -.2, 0), (0, 0, 0), (.2, -.2, 0)],
        }[name]
        for a, b in zip(points, points[1:]):
            tube("Attachment shaft", a, b, .024, "chrome")
        for side in (-1, 1):
            end = points[0] if side < 0 else points[-1]
            inner = points[1] if side < 0 else points[-2]
            grip = tuple(end[i] * .7 + inner[i] * .3 for i in range(3))
            tube("Textured grip", end, grip, .027, "rubber")
        tube("Cable eye", (0, 0, 0), (0, .08, 0), .013)
    export(prefix)


def export(name):
    # One draw per material in each moving group; retain the solver group roots.
    for parent in groups.values():
        by_material = {}
        for obj in list(parent.children):
            if obj.type == "MESH":
                by_material.setdefault(obj.data.materials[0].name, []).append(obj)
        for meshes in by_material.values():
            if len(meshes) < 2:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for obj in meshes:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = meshes[0]
            bpy.ops.object.join()
    version = ".v3.glb" if name == "row-machine" else ".v2.glb" if name in ("shoulder-press-machine", "leg-press") else ".v1.glb"
    path = OUT / (name + version)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True,
                              export_animations=False, export_cameras=False,
                              export_lights=False, export_extras=False)
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    stats[name] = {"bytes": path.stat().st_size, "meshes": len(meshes),
                   "triangles": sum(len(poly.vertices) - 2 for obj in meshes for poly in obj.data.polygons),
                   "groups": list(groups)}
    thumbnail(name)
    print(name, json.dumps(stats[name]))


def thumbnail(name):
    directory = EVIDENCE / "thumbnails"
    directory.mkdir(parents=True, exist_ok=True)
    carriage = {"smith-machine": (0, 1.855, -.12), "leg-press": (0, 1.42, .56),
                "cable-row-machine": (0, 1.23, .59), "lat-pulldown-machine": (0, 2.09, .22)}
    if "Handles" in groups and name in carriage:
        groups["Handles"].location = xyz(carriage[name])
    if "Weights" in groups:
        groups["Weights"].location = xyz((0, .49 if name == "lat-pulldown-machine" else .33 if name == "cable-row-machine" else .2 if name == "pec-deck" else 0, 0))
    if "Pulley" in groups:
        groups["Pulley"].location = xyz((0, 1.5, 0))
    if "Back" in groups:
        groups["Back"].location = xyz((0, .673, .253))
        groups["Back"].rotation_euler[0] = math.pi / 4
        base = xyz((0, .28, -.5))
        top = groups["Back"].rotation_euler.to_matrix() @ xyz((0, -.08, -.92)) + groups["Back"].location
        delta = top - base
        groups["Brace"].location = base
        groups["Brace"].rotation_mode = "QUATERNION"
        groups["Brace"].rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
        groups["Brace"].scale.z = delta.length
    if "LeftArm" in groups:
        groups["LeftArm"].location = xyz((.289, 2.62, 0))
        groups["RightArm"].location = xyz((-.289, 2.62, 0))
        groups["LeftArm"].rotation_euler[2] = math.radians(35.5)
        groups["RightArm"].rotation_euler[2] = -math.radians(35.5)
    if "LeftLever" in groups:
        row = name == "row-machine"
        chest = name == "chest-press-machine"
        if not row:
            kind = "chest-press" if chest else "shoulder-press"
            source = (ROOT / ("src/lib/motion/" + kind + ".ts")).read_text()
            press = json.loads(source.split("export const " + ("chestPress" if chest else "shoulderPress") + " = ", 1)[1].split(" as const;", 1)[0])
        for side, part in ((1, "LeftLever"), (-1, "RightLever")):
            groups[part].location = xyz((side * .55, .62, .55) if row else (side * press["pivot"][0], press["pivot"][1], press["pivot"][2]) if chest else (side * press["pivot"]["x"], press["pivot"]["y"], press["pivot"]["z"]))
            groups[part].rotation_euler[0] = math.radians(-6 if row else press["startDegrees"])
            if not row:
                rotation = Quaternion(xyz((1, 0, side * press["axisSlope"]) if chest else (1, side * press["axisSlope"], 0)).normalized(), math.radians(press["startDegrees"]))
                groups[part].rotation_mode = "QUATERNION"
                groups[part].rotation_quaternion = rotation
                swivel = groups["LeftNeutralGrip" if side == 1 else "RightNeutralGrip"]
                swivel.rotation_mode = "QUATERNION"
                swivel.rotation_quaternion = rotation.inverted()
    attachment = name.startswith("attachment-")
    # Fit the actual projected bounds, including moving roots, with equal margins.
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for obj in bpy.context.scene.objects if obj.type == "MESH" for corner in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    center = (low + high) / 2
    target = (center.x, center.z, -center.y)
    bpy.ops.object.camera_add(location=xyz((3.4, target[1] + 2.1, 4.4)))
    camera = bpy.context.object
    camera.rotation_euler = (xyz(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    inverse = camera.rotation_euler.to_matrix().transposed()
    projected = [inverse @ (point - center) for point in corners]
    camera.data.ortho_scale = max(max(p[i] for p in projected) - min(p[i] for p in projected) for i in (0, 1)) * 1.18
    bpy.context.scene.camera = camera
    for point, power, size in (((-3, 5, 4), 850, 5), ((3, 3, -2), 550, 4)):
        bpy.ops.object.light_add(type="AREA", location=xyz(point))
        lamp = bpy.context.object
        lamp.rotation_euler = (xyz(target) - lamp.location).to_track_quat("-Z", "Y").to_euler()
        lamp.data.energy = power
        lamp.data.shape = "DISK"
        lamp.data.size = size
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(directory / (name + ".png"))
    bpy.ops.render.render(write_still=True)


stats = {}
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="Regenerate selected equipment/attachment slugs")
    selected = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []).only
    for slug in ("smith-machine", "leg-press", "cable-row-machine", "pec-deck", "row-machine", "shoulder-press-machine"):
        if selected is None or slug in selected:
            machine(slug)
    for slug in ("cable-machine", "bench", "squat-rack", "barbell", "dumbbell", "kettlebell", "stool", "plyo-box", "resistance-band"):
        if selected is None or slug in selected:
            static(slug)
    for slug in ("d-handle", "rope", "straight-bar", "angled-bar", "lat-bar", "v-bar", "cuff"):
        if selected is None or "attachment-" + slug in selected:
            attachment(slug)
    if selected is None or "lat-pulldown-machine" in selected:
        new_scene()
        bpy.ops.import_scene.gltf(filepath=str(OUT / "lat-pulldown.v1.glb"))
        groups = {name: bpy.data.objects[name] for name in ("Static", "Weights", "Handles")}
        thumbnail("lat-pulldown-machine")
    report_path = EVIDENCE / "blender-export.json"
    if selected is not None and report_path.exists():
        stats = {**json.loads(report_path.read_text())["assets"], **stats}
    report_path.write_text(json.dumps({"blender": bpy.app.version_string, "assets": stats}, indent=2))
