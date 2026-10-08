import { z } from "zod";

/** No remote fixture writes or implicit physical-device attestations. */
export function hardwareProfileOptions(environment) {
  if (environment.HARDWARE_QUIET_WINDOW !== "1") throw new Error("Confirm a quiet measurement window with HARDWARE_QUIET_WINDOW=1");
  const local = value => {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
      throw new Error("Hardware fixtures require local app and Supabase URLs");
    }
    return url.origin;
  };
  const baseURL = local(environment.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001");
  local(environment.NEXT_PUBLIC_SUPABASE_URL);
  const gpu = z.enum(["default", "high-performance"]).parse(environment.HARDWARE_GPU ?? "default");
  const device = z.string().trim().min(1).max(120).parse(environment.HARDWARE_DEVICE);
  const expectedRenderer = z.string().trim().min(1).parse(environment.HARDWARE_EXPECT_RENDERER);
  return { baseURL, device, expectedRenderer, gpu,
    launchArgs: gpu === "high-performance" ? ["--force-high-performance-gpu"] : [] };
}

export function requireHardwareRenderer(renderer, expectedRenderer) {
  if (/swiftshader|llvmpipe|software|unknown|webkit webgl|^webgl/i.test(renderer)
    || !renderer.toLowerCase().includes(expectedRenderer.toLowerCase())) {
    throw new Error(`Reported hardware renderer does not match ${expectedRenderer}: ${renderer}`);
  }
  return renderer;
}
