import { test } from "node:test";
import { strict as assert } from "node:assert";
import { findWindowsRelease } from "./windows-release";

test("Windows downloads prefer the standalone installer", () => {
  assert.equal(findWindowsRelease([{ tag_name: "v1.0.1", assets: [
    { name: "webbai-windows.zip", browser_download_url: "https://github.com/zip" },
    { name: "webbai-windows.exe", browser_download_url: "https://github.com/exe" },
  ] }])?.url, "https://github.com/exe");
});
test("the current ZIP-only release remains downloadable", () => {
  assert.equal(findWindowsRelease([{ tag_name: "Webbai-windows-installer-v1.0.0", assets: [
    { name: "webbai-windows.zip", browser_download_url: "https://github.com/zip" },
  ] }])?.url, "https://github.com/zip");
});
test("drafts and releases without Windows assets are not offered", () => {
  assert.equal(findWindowsRelease([{ draft: true, tag_name: "v2", assets: [{ name: "webbai-windows.exe", browser_download_url: "hidden" }] }, { tag_name: "v1", assets: [] }]), null);
});