import express from "express";
import path from "path";
import { fileSearchTool, Agent, Runner } from "@openai/agents";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const fileSearch = fileSearchTool(["vs_68f12d4b76648191992344188f6a8f82"]);

const kbAgent = new Agent({
  name: "KB agent",
  instructions: `You are a helpful, factual assistant that answers questions using the Call Intelligence Knowledge Base. Always follow the structured 5-section output format.`,
  model: "gpt-5-mini",
  tools: [fileSearch],
  modelSettings: {
    reasoning: { effort: "low", summary: "auto" },
    store: true
  }
});

const runner = new Runner({});

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const items = [
      {
        role: "user",
        content: [{ type: "input_text", text: userMessage }]
      }
    ];

    const result = await runner.run(kbAgent, items);
    const final = result?.finalOutput ?? "⚠️ No final output returned by Agent.";

    res.json({ reply: final });
  } catch (err) {
    console.error("AGENT ERROR:", err);
    res.status(500).json({ reply: "Server error running the Agent." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server ready on", process.env.PORT || 3000);
});
