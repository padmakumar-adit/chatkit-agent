import express from "express";
import path from "path";
import { fileSearchTool, Agent, Runner } from "@openai/agents";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

console.log("Node version:", process.version);
console.log("API key loaded?", !!process.env.OPENAI_API_KEY);

const fileSearch = fileSearchTool([
  "vs_68f12d4b76648191992344188f6a8f82"
]);

const kbAgent = new Agent({
  name: "KB agent",
  instructions: `You are a helpful assistant using the CI Knowledge Base. Use structured formatting.`,
  model: "gpt-5-mini",
  tools: [fileSearch],
  modelSettings: {
    reasoning: { effort: "low", summary: "auto" },
    store: true
  }
});

const runner = new Runner();

app.post("/api/chat", async (req, res) => {
  try {
    console.log("Incoming message:", req.body);

    const items = [
      {
        role: "user",
        content: [{ type: "input_text", text: req.body.message }]
      }
    ];

    const result = await runner.run(kbAgent, items);

    console.log("Agent raw result:", result);

    const final = result?.finalOutput ?? "⚠️ No final output returned by Agent.";

    res.json({ reply: final });

  } catch (err) {
    console.error("AGENT ERROR FULL:", err);
    res.status(500).json({ reply: "Server error running the Agent." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});
