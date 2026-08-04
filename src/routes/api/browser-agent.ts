import { createFileRoute } from "@tanstack/react-router";

type Action =
  | { type: "click"; selector: string; reason?: string }
  | { type: "type"; selector: string; text: string; submit?: boolean }
  | { type: "scroll"; y: number }
  | { type: "navigate"; url: string }
  | { type: "wait"; ms: number }
  | { type: "done"; message: string };

type AgentBody = {
  task?: string;
  url?: string;
  pageState?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
};

export const Route = createFileRoute("/api/browser-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as AgentBody;
        const task = (body.task ?? "").trim();
        if (!task) return new Response("task required", { status: 400 });

        const [{ generateText, tool, stepCountIs }, { z }, gateway] =
          await Promise.all([
            import("ai"),
            import("zod"),
            import("@/lib/ai-gateway.server"),
          ]);

        const { createOpenRouterProvider, OPENROUTER_MODEL, withOpenRouterFallback, getOpenRouterKeys } = gateway;
        if (getOpenRouterKeys().length === 0) {
          return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
        }

        const actions: Action[] = [];
        const push = (a: Action) => {
          actions.push(a);
          return { queued: true, index: actions.length };
        };

        const historyText = (body.history ?? [])
          .slice(-6)
          .map((h) => `${h.role.toUpperCase()}: ${h.text}`)
          .join("\n");

        const result = await withOpenRouterFallback(async (key) => {
          actions.length = 0;
          const model = createOpenRouterProvider(key)(OPENROUTER_MODEL);
          return generateText({
          model,

          stopWhen: stepCountIs(50),
          system: `You are an in-page browser assistant. You control the current webpage by calling tools.
- Use short, safe CSS selectors from the provided page state (prefer #id, [name=...], or aria-label).
- Only call ONE tool at a time. After each action, briefly reason before the next.
- To fill a form: type into each field, then click submit or set submit:true on the last type.
- If the task is complete or you need info from the user, call \`done\` with a helpful message.
- Never call \`click\` on a selector you didn't see in the page state.`,
          prompt: `Current URL: ${body.url ?? "unknown"}
Task from user: ${task}

Recent conversation:
${historyText || "(none)"}

Page state (interactive elements):
${(body.pageState ?? "").slice(0, 8000)}

Plan and execute. Call \`done\` when finished.`,
          tools: {
            click: tool({
              description: "Click an element by CSS selector.",
              inputSchema: z.object({
                selector: z.string(),
                reason: z.string(),
              }),
              execute: async (i) => push({ type: "click", ...i }),
            }),
            type: tool({
              description: "Type text into an input/textarea by selector. Set submit=true to press Enter after.",
              inputSchema: z.object({
                selector: z.string(),
                text: z.string(),
                submit: z.boolean(),
              }),
              execute: async (i) => push({ type: "type", ...i }),
            }),
            scroll: tool({
              description: "Scroll the page vertically by y pixels (negative = up).",
              inputSchema: z.object({ y: z.number() }),
              execute: async (i) => push({ type: "scroll", ...i }),
            }),
            navigate: tool({
              description: "Navigate the current tab to a new full URL.",
              inputSchema: z.object({ url: z.string() }),
              execute: async (i) => push({ type: "navigate", ...i }),
            }),
            wait: tool({
              description: "Wait N milliseconds for the page to settle (max 3000).",
              inputSchema: z.object({ ms: z.number() }),
              execute: async (i) => push({ type: "wait", ms: Math.min(i.ms, 3000) }),
            }),
            done: tool({
              description: "Finish the task with a message to the user.",
              inputSchema: z.object({ message: z.string() }),
              execute: async (i) => push({ type: "done", ...i }),
            }),
          },
          });
        });


        return Response.json({ actions, summary: result.text });
      },
    },
  },
});
