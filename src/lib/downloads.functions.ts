import { createServerFn } from "@tanstack/react-start";

/**
 * Returns a short-lived signed URL for the Windows build.
 * Owner uploads `webbai-windows.exe` (or .zip) into the private `downloads`
 * bucket via the Backend view. This fn signs a fresh URL each click.
 */
export const getWindowsDownloadUrl = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from("downloads");

    // Try .exe first, fall back to .zip
    for (const name of ["webbai-windows.exe", "webbai-windows.zip"]) {
      const { data, error } = await bucket.createSignedUrl(name, 60 * 10);
      if (!error && data?.signedUrl) {
        return { url: data.signedUrl, filename: name };
      }
    }
    throw new Error(
      "No Windows build found in the downloads bucket yet. Upload webbai-windows.exe in the Backend view.",
    );
  },
);
