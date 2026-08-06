import type { UIMessage } from "ai";
import { getLocalBridge, type LocalChatChunk } from "@/lib/electron";

const SYSTEM_PROMPT = `You are webbai, a helpful AI assistant running locally on the user's computer.

You have a tool called open_website that opens a URL inside the app's in-app browser panel. Call it whenever the user asks you to open, show, visit, load, or look up a website. Always pass a full https:// URL.

Format regular replies using Markdown.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "open_website",
      description:
        "Open a website inside webbai's in-app browser panel. Use for any 'open X', 'show me X', 'visit X', 'look up X site' request.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full https:// URL to open" },
          title: { type: "string", description: "Short human-readable title" },
        },
        required: ["url", "title"],
      },
    },
  },
];

function toPlainText(message: UIMessage): string {
  return message.parts
    .map((p) => {
      const part = p as { type: string; text?: string };
      return part.type === "text" ? (part.text ?? "") : "";
    })
    .join("")
    .trim();
}

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * A `fetch` replacement for DefaultChatTransport that runs the conversation
 * against the locally installed Gemma 4 model through the Electron bridge,
 * emitting the AI SDK UI message stream protocol.
 */
export function createLocalChatFetch(): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const bridge = getLocalBridge();
    if (!bridge) throw new Error("Local AI runtime unavailable");

    const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: UIMessage[] };
    const uiMessages = body.messages ?? [];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...uiMessages.map((m) => ({ role: m.role, content: toPlainText(m) })),
    ].filter((m) => m.content.length > 0 || m.role === "system");

    const requestId = crypto.randomUUID();
    const textId = crypto.randomUUID();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let textOpen = false;
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          if (textOpen) controller.enqueue(sse({ type: "text-end", id: textId }));
          controller.enqueue(sse({ type: "finish" }));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          off();
        };

        const off = bridge.onChatChunk((chunk: LocalChatChunk) => {
          if (chunk.requestId !== requestId) return;
          if (chunk.type === "text" && chunk.delta) {
            if (!textOpen) {
              textOpen = true;
              controller.enqueue(sse({ type: "text-start", id: textId }));
            }
            controller.enqueue(sse({ type: "text-delta", id: textId, delta: chunk.delta }));
          } else if (chunk.type === "tool" && chunk.name === "open_website") {
            const toolCallId = crypto.randomUUID();
            const input = chunk.args ?? {};
            controller.enqueue(
              sse({
                type: "tool-input-available",
                toolCallId,
                toolName: "open_website",
                input,
              }),
            );
            controller.enqueue(
              sse({
                type: "tool-output-available",
                toolCallId,
                output: { ...input, opened: true },
              }),
            );
          } else if (chunk.type === "error") {
            if (!textOpen) {
              textOpen = true;
              controller.enqueue(sse({ type: "text-start", id: textId }));
            }
            controller.enqueue(
              sse({
                type: "text-delta",
                id: textId,
                delta: `\n\n_Local model error: ${chunk.message ?? "unknown"}_`,
              }),
            );
            close();
          } else if (chunk.type === "done") {
            close();
          }
        });

        controller.enqueue(sse({ type: "start" }));
        bridge
          .chat({ requestId, messages, tools: TOOLS })
          .catch(() => close())
          .then(() => {
            // safety timeout in case the done chunk never arrives
            setTimeout(close, 1000);
          });
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;
}
