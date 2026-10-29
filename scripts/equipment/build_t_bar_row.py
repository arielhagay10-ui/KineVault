"""Original chest-supported T-bar row, modelled from the supplied photo.

Metres, workshop Y-up. The single Lever group rotates about the rear bearing.
No third-party mesh, texture, branding or anatomy is included.
"""
import json
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

eq.new_scene()
eq.mats["frame"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.035, .04, .045, 1)

# Two splayed front legs and rear platform supports form the A frame.
for sign in (-1, 1):
    eq.box("Front floor shoe", (sign * .59, .025, .76), (.30, .05, .22), "rubber")
    eq.beam("Splayed upright", (sign * .59, .07, .76), (sign * .20, 1.18, .18), .10)
    eq.beam("Rear brace", (sign * .20, 1.18, .18), (sign * .29, .18, -.94), .09)
    eq.box("Rear floor shoe", (sign * .29, .025, -.94), (.22, .05, .25), "rubber")
eq.beam("Pad bridge", (-.20, 1.18, .18), (.20, 1.18, .18), .09)
eq.beam("Bearing crossmember", (-.29, .35, -.85), (.29, .35, -.85), .08)
eq.tube("Pivot axle", (-.34, .35, -.85), (.34, .35, -.85), .035)
for sign in (-1, 1):
    eq.tube("Pivot housing", (sign * .26, .35, -.85), (sign * .31, .35, -.85), .065, "iron")
    eq.tube("Pivot bolt", (sign * .31, .35, -.85), (sign * .345, .35, -.85), .023, "chrome", sides=6)

pad = eq.box("Chest cushion", (0, 1.24, .18), (.43, .57, .14), "pad", bevel=.035)
pad.rotation_euler[0] = math.pi / 4
back = eq.box("Chest pad backing", (0, 1.19, .23), (.38, .49, .025), "frame")
back.rotation_euler[0] = math.pi / 4
eq.beam("Chest pad support", (0, .87, .27), (0, 1.18, .24), .10)
for sign in (-1, 1):
    plate = eq.box("Foot platform", (sign * .24, .26, -.79), (.33, .04, .48), "chrome", bevel=.012)
    plate.rotation_euler[0] = -math.pi / 12
    # Raised tread leaves a solid load-bearing surface beneath each sole.
    for index in range(6):
        z = (index - 2.5) * .064
        p = eq.xyz((0, .023, z))
        p.rotate(plate.rotation_euler)
        tread = eq.box("Platform tread", (sign * .24 + p.x, .26 + p.z, -.79 - p.y), (.27, .006, .012), "rubber", bevel=.002)
        tread.rotation_euler[0] = -math.pi / 12
    eq.beam("Platform bracket", (sign * .24, .12, -.99), (sign * .24, .25, -.72), .06)

# All following coordinates are relative to the rear pivot.
eq.beam("T-bar spine", (0, 0, 0), (0, .04, 1.78), .085, parent="Lever")
eq.beam("Handle bridge", (-.36, .04, 1.40), (.36, .04, 1.40), .07, parent="Lever")
for sign in (-1, 1):
    eq.beam("Handle riser", (sign * .36, .04, 1.40), (sign * .33, .20, 1.46), .065, parent="Lever")
    eq.beam("Handle riser", (sign * .33, .20, 1.46), (sign * .28, .34, 1.40), .065, parent="Lever")
    eq.tube("Neutral handle", (sign * .28, .292, 1.218), (sign * .28, .388, 1.482), .025, "chrome", "Lever", 24)
    eq.tube("Wide handle", (sign * .28, .38, 1.40), (sign * .53, .38, 1.40), .025, "chrome", "Lever", 24)
    eq.tube("Handle end cap", (sign * .28, .388, 1.482), (sign * .28, .395, 1.501), .027, "rubber", "Lever")
eq.tube("Plate sleeve", (0, .04, 1.78), (0, .04, 2.05), .025, "chrome", "Lever", 24)
eq.tube("Plate stop", (0, .04, 1.73), (0, .04, 1.78), .055, "iron", "Lever")
eq.tube("Sleeve end cap", (0, .04, 2.04), (0, .04, 2.07), .027, "rubber", "Lever")
eq.box("Rest stop", (0, .32, .55), (.15, .08, .16), "rubber")
eq.beam("Rest bracket", (0, .08, .70), (0, .29, .55), .065)
eq.groups["Lever"].location = eq.xyz((0, .35, -.85))

source = eq.EVIDENCE / "t-bar-row-machine.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(source))
eq.export("t-bar-row-machine")
(eq.EVIDENCE / "t-bar-row-export.json").write_text(json.dumps(eq.stats, indent=2))
