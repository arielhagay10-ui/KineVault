"""Original converging chest press, informed by the supplied handle reference.

Metres/Y-up. Independent bottom pivots and bearing-mounted multi-position
handles. No third-party mesh, texture or branding is included.
"""
import json
import math
import sys
from pathlib import Path

import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

source = (eq.ROOT / "src/lib/motion/chest-press.ts").read_text()
press = json.loads(source.split("export const chestPress = ", 1)[1].split(" as const;", 1)[0])
eq.new_scene()
for name in ("Static", "Weights", "Handles"):
    eq.group(name)
eq.mats["frame"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.035, .041, .047, 1)
eq.feet(.63, .85, -.64)
eq.beam("Seat pedestal", (0, .1, 0), (0, .53, 0), .11)
eq.box("Seat cushion", press["seat"]["center"], press["seat"]["size"], "pad", bevel=.04)
eq.beam("Backrest spine", (0, .1, -.30), (0, 1.78, -.36), .085)
eq.beam("Backrest brace", (0, .1, -.59), (0, 1.20, -.32), .07)
back = eq.box("Back cushion", press["back"]["center"], press["back"]["size"], "pad", bevel=.045)
back.rotation_euler[0] = math.radians(press["back"]["degrees"])
eq.box("Head cushion", (0, 1.84, -.31), (.28, .20, .12), "pad", bevel=.035)
eq.beam("Seat crossmember", (-.7, .25, press["pivot"][2]), (.7, .25, press["pivot"][2]), .10)
eq.beam("Stack crossmember", (-1.05, .12, -.46), (.63, .12, -.46), .10)
eq.box("Stack base", (-1.05, .09, -.46), (.38, .16, .43), "iron", bevel=.035)
eq.box("Stack rear shroud", (-1.05, 1.07, -.62), (.35, 1.88, .08), "frame", bevel=.035)
for x in (-1.23, -.87):
    eq.tube("Stack upright", (x, .14, -.46), (x, 2.03, -.46), .038, "frame")
eq.box("Stack cap", (-1.05, 2.04, -.46), (.42, .10, .43), "iron", bevel=.045)
for x in (-1.14, -.96):
    eq.tube("Guide rod", (x, .17, -.46), (x, 1.97, -.46), .012)
for index in range(13):
    eq.box("Stack plate", (-1.05, .24 + index * .052, -.46), (.29, .042, .25), "iron", "Weights", .005)
eq.tube("Selector pin", (-1.05, .47, -.30), (-1.05, .47, -.23), .015, "accent", "Weights")

handle = press["handle"]
for sign, side in ((1, "Left"), (-1, "Right")):
    pivot = (sign * press["pivot"][0], press["pivot"][1], press["pivot"][2])
    parent = side + "Lever"
    eq.group(parent).location = eq.xyz(pivot)
    eq.beam("Bearing upright", (pivot[0], .12, pivot[2]), pivot, .10)
    eq.tube("Pivot housing", (pivot[0] - .08, pivot[1], pivot[2] - sign * press["axisSlope"] * .08), (pivot[0] + .08, pivot[1], pivot[2] + sign * press["axisSlope"] * .08), .072, "iron")
    end = (sign * press["arm"][0], press["arm"][1], press["arm"][2])
    points = [(0, 0, 0), (sign * .08, .34, .02), (sign * .04, .68, .01), end]
    for a, b in zip(points, points[1:]):
        eq.tube("Curved press arm", a, b, .047, "frame", parent, 24)
    eq.tube("Handle bearing", (-sign * .33, 1.02, 0), (-sign * .23, 1.02, 0), .04, "chrome", parent)
    grip = eq.group(side + "NeutralGrip")
    grip.parent = eq.group(parent)
    grip.location = eq.xyz(end)
    for a, b in zip(handle, handle[1:]):
        eq.tube("Multi-position rubber handle", (sign * a[0], a[1], a[2]), (sign * b[0], b[1], b[2]), .024, "rubber", side + "NeutralGrip", 24)
    for p in handle[1:-1]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=.024, location=eq.xyz((sign * p[0], p[1], p[2])))
        eq.finish("Rounded handle bend", bpy.context.object, "rubber", side + "NeutralGrip")
    for p in (handle[0], handle[-1]):
        eq.tube("Handle end cap", (sign * p[0], p[1], p[2] - .002), (sign * p[0], p[1], p[2] + .002), .025, "chrome", side + "NeutralGrip", 24)

eq.bpy.ops.wm.save_as_mainfile(filepath=str(eq.EVIDENCE / "chest-press-machine.blend"))
eq.export("chest-press-machine")
(eq.EVIDENCE / "chest-press-export.json").write_text(json.dumps(eq.stats, indent=2))
