import express from "express";
import path from "path";
import fs from "fs";
import { fileSearchTool, Agent, Runner } from "@openai/agents";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

const FILE_SEARCH_ID = process.env.FILE_SEARCH_ID || "vs_68f12d4b76648191992344188f6a8f82";
const fileSearch = fileSearchTool([FILE_SEARCH_ID]);

const kbAgent = new Agent({
  name: "KB agent",
  instructions: `You are a helpful, factual assistant that answers questions using the Call Intelligence Knowledge Base. Always follow the structured 5-section output format.`,
  model: "gpt-5-mini",
  tools: [fileSearch],
  modelSettings: { reasoning: { effort: "low", summary: "auto" }, store: true }
});

const runner = new Runner();

// simple feedback store
const FEEDBACK_FILE = path.join(process.cwd(), "feedbacks.json");
if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, "[]", "utf8");
function saveFeedback(obj){
  const cur = JSON.parse(fs.readFileSync(FEEDBACK_FILE,"utf8")||"[]");
  cur.push(Object.assign({ ts: new Date().toISOString() }, obj));
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(cur, null, 2), "utf8");
}

// Streaming SSE endpoint
app.get("/api/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const userMessage = req.query.q || "";
  if (!userMessage) {
    res.write("event: error\n");
    res.write("data: {"error":"missing message"}\n\n");
    return res.end();
  }

  try {
    const items = [{ role: "user", content: [{ type: "input_text", text: userMessage }] }];
    const stream = await runner.runStream(kbAgent, items);

    // accumulate final text as fallback
    let accumulated = "";

    for await (const event of stream) {
      // token delta events
      if (event.type === "response.output_text.delta") {
        const delta = event.delta ?? "";
        // event.delta may be string or object; ensure string
        const d = typeof delta === "string" ? delta : JSON.stringify(delta);
        accumulated += d;
        res.write(`data: ${JSON.stringify({ type: "delta", text: d })}\n\n`);
      }

      // completed event with final output if present
      if (event.type === "response.completed") {
        const finalText = event.output_text ?? accumulated;
        res.write(`data: ${JSON.stringify({ type: "done", text: finalText })}\n\n`);
        break;
      }
    }
  } catch (err) {
    console.error("STREAM ERROR:", err);
    res.write("event: error\n");
    res.write("data: {"error":"stream failed"}\n\n");
  } finally {
    res.end();
  }
});

// feedback endpoint
app.post("/api/feedback", (req, res) => {
  try {
    const { message_id, thumbs_up, comment, user } = req.body;
    if (!message_id) return res.status(400).json({ error: "message_id required" });
    saveFeedback({ message_id, thumbs_up: !!thumbs_up, comment: comment || "", user: user || null });
    res.json({ ok: true });
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () => {
  console.log("Server ready on", process.env.PORT || 3000);
});
