import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown; threadId?: string };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const [{ convertToModelMessages, streamText, tool, stepCountIs }, { z }, gateway] =
          await Promise.all([
            import("ai"),
            import("zod"),
            import("@/lib/ai-gateway.server"),
          ]);

        const {
          createOpenRouterProvider,
          OPENROUTER_MODEL,
          OPENROUTER_VISION_MODEL,
          pickOpenRouterKey,
        } = gateway;
        const key = await pickOpenRouterKey();
        if (!key) return new Response("Missing OPENROUTER_API_KEY", { status: 500 });

        const messages = body.messages as UIMessage[];
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const hasImage = (lastUserMsg?.parts ?? []).some(
          (p) =>
            (p as { type?: string; mediaType?: string }).type === "file" &&
            String((p as { mediaType?: string }).mediaType ?? "").startsWith("image/"),
        );

        const openrouter = createOpenRouterProvider(key);
        const model = openrouter(hasImage ? OPENROUTER_VISION_MODEL : OPENROUTER_MODEL);

        const result = streamText({
          model,
          system: `You are a helpful AI assistant embedded in a desktop-style app.

You have a special tool called \`open_website\` that opens a URL inside an in-app browser panel next to the chat. Call it whenever the user asks you to open, show, visit, load, or pull up a website.

Format regular replies using Markdown.

If the user's message includes a screenshot, it is a live capture of the screen they are looking at right now — read it and answer about what is visible.`,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(5),
          tools: {
            open_website: tool({
              description:
                "Open a website inside the app's in-app browser panel. Use for any 'open X', 'show me X site', 'visit X' request.",
              inputSchema: z.object({
                url: z.string().describe("Full https:// URL to open"),
                title: z.string().describe("Short human-readable title for the site"),
              }),
              execute: async ({ url, title }) => {
                return { url, title, opened: true };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
