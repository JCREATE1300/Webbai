import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/chat", replace: true }); },
  head: () => ({ meta: [
    { title: "webbai — AI chat and browser" },
    { name: "description", content: "Chat with your webbai assistant and open websites alongside your conversation." },
    { property: "og:title", content: "webbai — AI chat and browser" },
    { property: "og:description", content: "Ask questions and browse websites with your webbai assistant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});