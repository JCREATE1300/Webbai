import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";

type ChatBody = { messages?: unknown; threadId?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.OPENROUTER_API_KEY;
        if (!key) return new Response("Missing OPENROUTER_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        const [{ convertToModelMessages, streamText, tool, stepCountIs }, { z }, { createOpenRouterProvider, OPENROUTER_MODEL }] =
          await Promise.all([
            import("ai"),
            import("zod"),
            import("@/lib/ai-gateway.server"),
          ]);

        const openrouter = createOpenRouterProvider(key);
        const model = openrouter(OPENROUTER_MODEL);
        const threadId = body.threadId;

        const messages = body.messages as UIMessage[];

        const result = streamText({
          model,
          system: `You are a helpful AI assistant embedded in a desktop-style app.

You have a special tool called \`open_website\` that opens a URL inside an in-app browser panel next to the chat. Call it whenever the user asks you to open, show, visit, load, or pull up a website. Always pass a full https:// URL. After calling the tool, briefly tell the user what you opened.

Format regular replies using Markdown.`,
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

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            if (!threadId || !authHeader) return;
            try {
              const { createClient } = await import("@supabase/supabase-js");
              const supabase = createClient(
                process.env.SUPABASE_URL!,
                process.env.SUPABASE_PUBLISHABLE_KEY!,
                {
                  global: { headers: { Authorization: authHeader } },
                  auth: { persistSession: false, autoRefreshToken: false },
                },
              );
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData.user?.id;
              if (!userId) return;

              // Persist the last user message and the new assistant message(s)
              const lastUser = [...messages].reverse().find((m) => m.role === "user");
              const newAssistants = finalMessages.filter((m) => m.role === "assistant");

              const rows: Array<{
                thread_id: string;
                user_id: string;
                role: string;
                parts: unknown;
              }> = [];
              if (lastUser) {
                rows.push({
                  thread_id: threadId,
                  user_id: userId,
                  role: "user",
                  parts: lastUser.parts,
                });
              }
              for (const m of newAssistants) {
                rows.push({
                  thread_id: threadId,
                  user_id: userId,
                  role: m.role,
                  parts: m.parts,
                });
              }
              if (rows.length) {
                await supabase.from("messages").insert(rows);
              }
              await supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            } catch (err) {
              console.error("Persist chat error", err);
            }
          },
        });

        return response;
      },
    },
  },
});
