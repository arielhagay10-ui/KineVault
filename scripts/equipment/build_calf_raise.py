"""Original standing calf raise machine.

Metres, workshop Y-up. Shared dimensions come from src/lib/motion/calf-raise.ts.
The Handles group is the shoulder-pad carriage: it slides on two guide rods and the
runtime lifts it with the figure. Weights rises with travel.
No third-party mesh, texture, branding or anatomy is included.
"""
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_equipment as eq

source = (eq.ROOT / "src/lib/motion/calf-raise.ts").read_text()
calf = json.loads(source.split("export const calfRaise = ", 1)[1].split(" as const;", 1)[0])
NAME = "calf-raise-machine"
plat, pad, handle, guide = calf["platform"], calf["pad"], calf["handle"], calf["guide"]

eq.new_scene()
for part in ("Static", "Weights", "Handles"):
    eq.group(part)
eq.feet(.62, .62, -1.2)

# Toe platform: the balls of the feet rest on its rounded rear edge; the heels hang behind it.
depth, middle = plat["front"] - plat["edge"], (plat["front"] + plat["edge"]) / 2
eq.box("Toe platform", (0, .125, middle), (plat["width"], .05, depth))
eq.box("Platform tread", (0, plat["top"] - .005, middle + .006), (plat["width"] - .02, .01, depth - .012), "rubber", bevel=.003)
eq.tube("Platform nose", (-plat["width"] / 2 + .01, plat["top"] - .012, plat["edge"] + .012), (plat["width"] / 2 - .01, plat["top"] - .012, plat["edge"] + .012), .012, "rubber", sides=20)
for z in (.2, .45):
    eq.beam("Platform crossmember", (-.62, .1, z), (.62, .1, z))

# Main frame: uprights behind the figure carry the carriage guide rods.
eq.beam("Frame crossmember", (-.62, .1, -.6), (.62, .1, -.6))
for sign in (-1, 1):
    eq.beam("Frame upright", (sign * .38, .1, -.6), (sign * .38, 3.05, -.6), .09)
    eq.tube("Carriage guide", (sign * guide["x"], .25, guide["z"]), (sign * guide["x"], 2.98, guide["z"]), .022)
    for y in (.25, 2.98):
        eq.box("Guide bracket", (sign * (guide["x"] + .38) / 2, y, (guide["z"] - .6) / 2), (.16, .05, .16))
eq.beam("Top crossmember", (-.38, 3.05, -.6), (.38, 3.05, -.6), .09)

# Weight stack tower behind the frame.
eq.weight_stack(0, -.95, .2, calf["weights"])
for sign in (-1, 1):
    eq.beam("Stack upright", (sign * .3, .1, -1.12), (sign * .3, 2.6, -1.12), .08)
    eq.beam("Stack tie", (sign * .3, 2.6, -1.12), (sign * .38, 2.6, -.6), .06)
eq.beam("Stack head", (-.3, 2.6, -1.12), (.3, 2.6, -1.12), .08)
for y in (.14, 2.5):
    eq.box("Guide plate", (0, y, -.95), (.66, .04, .26))

# Carriage, local to the pad axis at the yoke's center.
back, front, radius = pad["back"], pad["front"], pad["radius"]
top = radius + .012
for sign in (-1, 1):
    x = sign * pad["x"]
    eq.tube("Shoulder pad", (x, 0, back), (x, 0, front), radius, "pad", "Handles", 32)
    eq.box("Pad backing", (x, top, (back + front) / 2), (.075, .024, front - back - .02), "frame", "Handles")
    eq.beam("Pad arm", (x, top, back + .03), (sign * guide["x"], top, guide["z"] + .045), .05, "frame", "Handles")
    eq.tube("Guide sleeve", (sign * guide["x"], -.12, guide["z"]), (sign * guide["x"], .14, guide["z"]), .04, "iron", "Handles", 24)
    hx, hy, hz, half = sign * handle["x"], -handle["drop"], handle["z"], handle["length"] / 2
    eq.tube("Handle arm", (x, top, front - .02), (hx, top, hz), .022, "chrome", "Handles")
    eq.tube("Handle post", (hx, top, hz), (hx, hy + half, hz), .022, "chrome", "Handles")
    eq.tube("Handle grip", (hx, hy + half, hz), (hx, hy - half, hz), handle["radius"], "rubber", "Handles", 24)
    eq.tube("Handle end cap", (hx, hy - half, hz), (hx, hy - half - .012, hz), .028, "chrome", "Handles")
eq.box("Carriage plate", (0, 0, guide["z"] - .05), (2 * guide["x"] + .1, .26, .03), "frame", "Handles")
eq.groups["Handles"].location = eq.xyz((0, plat["top"] + pad["rise"], 0))

bpy.ops.wm.save_as_mainfile(filepath=str(eq.EVIDENCE / (NAME + ".blend")))
eq.export(NAME)
(eq.EVIDENCE / (NAME + "-export.json")).write_text(json.dumps(eq.stats[NAME], indent=2))
