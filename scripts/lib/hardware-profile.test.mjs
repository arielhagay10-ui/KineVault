import assert from "node:assert/strict";
import test from "node:test";
import { hardwareProfileOptions, requireHardwareRenderer } from "./hardware-profile.mjs";

const environment = {
  HARDWARE_QUIET_WINDOW: "1", HARDWARE_DEVICE: "LENOVO 83F5 / Windows 11",
  HARDWARE_EXPECT_RENDERER: "Intel", PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
};

test("measurement refuses remote fixtures and missing quiet-window attestation", () => {
  assert.throws(() => hardwareProfileOptions({ ...environment, HARDWARE_QUIET_WINDOW: "0" }), /quiet/i);
  for (const key of ["PLAYWRIGHT_BASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    assert.throws(() => hardwareProfileOptions({ ...environment, [key]: "https://example.com" }), /local/i);
  }
});

test("hardware proof rejects software and an unexpected adapter", () => {
  for (const renderer of ["ANGLE SwiftShader", "llvmpipe", "WebKit WebGL", "unknown", "ANGLE NVIDIA RTX 5070 Ti"]) {
    assert.throws(() => requireHardwareRenderer(renderer, "Intel"));
  }
  assert.equal(requireHardwareRenderer("ANGLE (Intel, Intel Graphics D3D11)", "Intel"), "ANGLE (Intel, Intel Graphics D3D11)");
});

test("high-performance request never becomes GPU identity evidence", () => {
  const options = hardwareProfileOptions({ ...environment, HARDWARE_GPU: "high-performance", HARDWARE_EXPECT_RENDERER: "NVIDIA" });
  assert.deepEqual(options.launchArgs, ["--force-high-performance-gpu"]);
  assert.throws(() => requireHardwareRenderer("ANGLE Intel Graphics", options.expectedRenderer));
  assert.throws(() => hardwareProfileOptions({ ...environment, HARDWARE_GPU: "swiftshader" }));
});
