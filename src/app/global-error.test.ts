import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GlobalError from "./global-error";

it("offers standalone root recovery without displaying error details", () => {
  const html = renderToStaticMarkup(createElement(GlobalError, {
    error: Object.assign(new Error("private database detail"), { digest: "private-digest" }),
    reset: () => undefined,
  }));
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("<body");
  expect(html).toContain('<main');
  expect(html).toContain('role="alert"');
  expect(html).toContain('type="button"');
  expect(html).toContain("Try again");
  expect(html).toContain('href="/"');
  expect(html).not.toContain("private database detail");
  expect(html).not.toContain("private-digest");
});
