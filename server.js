import express from "express";
import path from "path";
import fs from "fs";
import { fileSearchTool, Agent, Runner } from "@openai/agents";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

const FILE_SEARCH_ID =
  process.env.FILE_SEARCH_ID || "vs_68f12d4b76648191992344188f6a8f82";

const fileSearch = fileSearchTool([FILE_SEARCH_ID]);

const kbAgent = new Agent({
  name: "KB agent",
  instructions: `You are a helpful, factual assistant that strictly uses knowledge base files.`,
  model: "gpt-5-mini",
  tools: [fileSearch],
  modelSettings: {
    reasoning: { effort: "low", summary: "auto" },
    store: true,
  },
});

const runner = new Runner();

/* ------------------ STREAMING ENDPOINT ------------------ */

app.get("/api/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const userMessage = req.query.q || "";
  if (!userMessage) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: "missing message" })}\n\n`);
    return res.end();
  }

  try {
    const items = [
      {
        role: "user",
        content: [{ type: "input_text", text: userMessage }],
      },
    ];

    // ✔ CORRECT STREAMING CALL (works in all versions)
    const stream = await runner.run(kbAgent, items, { stream: true });

    let accumulated = "";

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const delta =
          typeof event.delta === "string" ? event.delta : "";

        if (delta) {
          accumulated += delta;
          res.write(
            `data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`
          );
        }
      }

      if (event.type === "response.completed") {
        const finalText = event.output_text || accumulated;

        res.write(
          `data: ${JSON.stringify({ type: "done", text: finalText })}\n\n`
        );

        break;
      }
    }
  } catch (err) {
    console.error("STREAM ERROR:", err);
    res.write(`event: error\n`);
    res.write(
      `data: ${JSON.stringify({ error: "stream failed", details: err.message })}\n\n`
    );
  } finally {
    res.end();
  }
});

/* ------------------ FEEDBACK ENDPOINT ------------------ */

app.post("/api/feedback", (req, res) => {
  try {
    const { message_id, thumbs_up, comment, user } = req.body;

    if (!message_id)
      return res.status(400).json({ error: "message_id required" });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "feedback server error" });
  }
});

/* ------------------ HEALTH ------------------ */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 8080, () =>
  console.log("Server ready on port", process.env.PORT || 8080)
);
