"""Original seated lateral raise machine.

Metres, workshop Y-up. Shared dimensions come from src/lib/motion/lateral-raise.ts.
LeftLever and RightLever turn about front-to-back axes through the seated shoulders;
each carries an upper-arm pad and a neutral handle. Weights rises with travel.
No third-party mesh, texture, branding or anatomy is included.
"""
import json
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

source = (eq.ROOT / "src/lib/motion/lateral-raise.ts").read_text()
raise_ = json.loads(source.split("export const lateralRaise = ", 1)[1].split(" as const;", 1)[0])
NAME = "lateral-raise-machine"

eq.new_scene()
for part in ("Static", "Weights", "LeftLever", "RightLever"):
    eq.group(part)
eq.feet(.56, .8, -1.25)
seat, back = raise_["seat"], raise_["back"]
eq.box("Seat cushion", seat["center"], seat["size"], "pad", bevel=.035)
seat_bottom = seat["center"][1] - seat["size"][1] / 2
eq.beam("Seat pedestal", (0, .1, .02), (0, seat_bottom - .02, .02), .1)
eq.beam("Seat bearer", (0, seat_bottom - .045, -.33), (0, seat_bottom - .045, .22), .085)
eq.beam("Seat base tie", (-.56, .1, .02), (.56, .1, .02))
eq.box("Back cushion", back["center"], back["size"], "pad", bevel=.04)
back_rear = back["center"][2] - back["size"][2] / 2
eq.box("Back pad backing", (0, back["center"][1], back_rear - .0125), (back["size"][0] - .06, back["size"][1] - .08, .025), "frame")
eq.beam("Backrest upright", (0, .1, -.36), (0, 1.86, -.36), .09)
for y in (1.0, 1.6):
    eq.beam("Back pad bracket", (0, y, -.36), (0, y, back_rear - .025), .06)

# Bearing tower behind the back pad holds both shoulder-axis bearings.
px, py, pz = raise_["pivot"]
eq.beam("Bearing tower base", (-.56, .1, -.52), (.56, .1, -.52))
for sign in (-1, 1):
    eq.beam("Bearing tower upright", (sign * .5, .1, -.52), (sign * .5, 1.86, -.52), .09)
    eq.beam("Bearing arm", (sign * .5, py, -.52), (sign * px, py, -.52), .075)
    eq.tube("Bearing housing", (sign * px, py, -.56), (sign * px, py, -.47), .075, "iron", sides=24)
eq.beam("Bearing tower head", (-.5, 1.86, -.52), (.5, 1.86, -.52), .09)
eq.beam("Backrest tie", (0, 1.86, -.36), (0, 1.86, -.52), .07)

# Stack tower; the cable runs inside the frame to the bearing cams.
eq.beam("Rear crossmember", (-.56, .1, -1.25), (.56, .1, -1.25))
for sign in (-1, 1):
    eq.beam("Tower upright", (sign * .3, .1, -1.15), (sign * .3, 2.55, -1.15), .09)
    eq.beam("Tower tie", (sign * .3, 1.86, -1.15), (sign * .3, 1.86, -.52), .07)
eq.beam("Tower head", (-.3, 2.55, -1.15), (.3, 2.55, -1.15), .09)
eq.box("Tower shroud", (0, 1.33, -1.215), (.6, 2.4, .02), "frame")
eq.weight_stack(0, -1.1, .2, raise_["weights"])
for y in (.14, 2.5):
    eq.box("Guide plate", (0, y, -1.12), (.66, .04, .26), "frame")

pad = raise_["pad"]
hx, hy, hz = raise_["handle"]
for sign, parent in ((1, "LeftLever"), (-1, "RightLever")):
    # Lever-local coordinates are relative to the shoulder pivot with the arm lowered (0 degrees).
    lateral, along, grip_x, grip_y = sign * pad["lateral"], pad["along"], sign * (hx - px), hy - py
    eq.tube("Lever hub", (0, 0, -.47), (0, 0, -.38), .065, "iron", parent, 24)
    eq.beam("Lever arm", (0, 0, -.42), (lateral, along, -.42), .07, "iron", parent)
    eq.tube("Pad axle", (lateral, along, -.42), (lateral, along, pad["front"] + .02), .02, "chrome", parent)
    eq.tube("Arm pad", (lateral, along, pad["back"]), (lateral, along, pad["front"]), pad["radius"], "pad", parent, 32)
    eq.tube("Handle rail", (lateral, along, pad["front"] + .02), (lateral, along, hz), .022, "chrome", parent)
    eq.tube("Handle bridge", (lateral, along, hz), (grip_x, along, hz), .022, "chrome", parent)
    eq.tube("Neutral handle", (grip_x, along, hz), (grip_x, grip_y - .12, hz), .025, "rubber", parent, 24)
    eq.tube("Handle end cap", (grip_x, grip_y - .12, hz), (grip_x, grip_y - .135, hz), .028, "chrome", parent)
    eq.groups[parent].location = eq.xyz((sign * px, py, pz))
    # Blender's Y axis is the workshop's -Z, so a workshop Z turn is a negative Blender Y turn.
    eq.groups[parent].rotation_euler[1] = -sign * math.radians(raise_["startDegrees"])

bpy.ops.wm.save_as_mainfile(filepath=str(eq.EVIDENCE / (NAME + ".blend")))
eq.export(NAME)
(eq.EVIDENCE / (NAME + "-export.json")).write_text(json.dumps(eq.stats[NAME], indent=2))
