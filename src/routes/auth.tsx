import { createFileRoute, redirect } from "@tanstack/react-router";

// Existing bookmarks and older desktop builds go straight to account-free chat.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => { throw redirect({ to: "/chat", replace: true }); },
  head: () => ({ meta: [
    { title: "Open chat — webbai" },
    { name: "description", content: "Open webbai chat without an account." },
    { property: "og:title", content: "Open chat — webbai" },
    { property: "og:description", content: "Go straight to your webbai conversations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});