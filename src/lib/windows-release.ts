export const WINDOWS_RELEASES_API = "https://api.github.com/repos/JCREATE1300/webbai/releases";

type Release = {
  draft?: boolean;
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
};

export function findWindowsRelease(releases: Release[]) {
  for (const release of releases) {
    if (release.draft) continue;
    const asset = release.assets.find((a) => a.name === "webbai-windows.exe")
      ?? release.assets.find((a) => a.name === "webbai-windows.zip");
    if (asset) return { version: release.tag_name, url: asset.browser_download_url };
  }
  return null;
}