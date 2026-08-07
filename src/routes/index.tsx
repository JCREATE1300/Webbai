import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, MousePointerClick, Download, MessagesSquare } from "lucide-react";
import { WebbaiMark } from "@/components/WebbaiMark";
import { Button } from "@/components/ui/button";

const TITLE = "webbai — AI browser assistant that opens and uses websites";
const DESCRIPTION =
  "webbai is an AI browser: chat with a website, ask the assistant to open any page in-app, and let it click, type and scroll for you. Free on the web, plus a Windows app.";
const URL = "https://webbai.lovable.app/";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "webbai",
          applicationCategory: "BrowserApplication",
          operatingSystem: "Web, Windows",
          description: DESCRIPTION,
          url: URL,
        }),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Chat with an AI assistant",
    body: "Ask questions in threads that are saved to your account, so you can pick a conversation back up on any device.",
  },
  {
    icon: Globe,
    title: "Open websites in the app",
    body: "Say “open wikipedia.org” and the page loads in a panel next to the chat — expand it to fullscreen whenever you need more room.",
  },
  {
    icon: MousePointerClick,
    title: "Let it use the page for you",
    body: "In the Windows app, a floating assistant sits on top of the site and can click buttons, fill fields and scroll to finish a task.",
  },
  {
    icon: Download,
    title: "Windows app included",
    body: "Sign in and download the Windows build from the sidebar to get the desktop version with the on-page assistant.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
      <div className="mx-auto max-w-4xl px-4 py-20">
        <header className="text-center">
          <WebbaiMark size={56} className="mx-auto" />

          <h1 className="mt-6 text-4xl font-semibold tracking-tight">
            webbai — an AI browser you can talk to
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Chat with a website instead of hunting through it. Ask webbai to open a page and it
            appears right beside the conversation, ready to read, summarise and act on.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Start chatting free</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                <Download className="h-4 w-4" /> Get the Windows app
              </Button>
            </Link>
          </div>
        </header>

        <section className="mt-16" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-xl font-semibold">
            What you can do with webbai
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-xl font-semibold">
            How it works
          </h2>
          <ol className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>1. Create an account or sign in with Google.</li>
            <li>2. Start a thread and ask a question, or say “open” followed by a site.</li>
            <li>3. The site opens in the in-app browser panel — toggle fullscreen to focus on it.</li>
            <li>4. Install the Windows app to get the on-page assistant that can click and type.</li>
          </ol>
          <div className="mt-8">
            <Link to="/auth">
              <Button>Open webbai</Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
