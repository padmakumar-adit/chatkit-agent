import express from "express";
import fetch from "node-fetch";
import path from "path";

const app = express();
app.use(express.json());

// Serve static Chat UI
app.use(express.static(path.join(process.cwd(), "public")));

/**
 * UNIVERSAL WORKFLOW CALLER
 * Works with any OpenAI Workflow / Agent Builder output.
 */
app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    const openaiResp = await fetch(
      `https://api.openai.com/v1/workflows/${process.env.AGENT_ID}/runs`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: { question: message }
        })
      }
    );

    const data = await openaiResp.json();
    console.log("RAW RESPONSE:", JSON.stringify(data, null, 2));

    let reply = null;

    // 1. Workflow outputs with output_text
    if (data.output_text) reply = data.output_text;

    // 2. output.final
    if (!reply && data.output?.final) reply = data.output.final;

    // 3. output.result
    if (!reply && data.output?.result) reply = data.output.result;

    // 4. Agent-style message outputs
    if (!reply && Array.isArray(data.messages)) {
      const last = data.messages[data.messages.length - 1];
      if (last?.content?.[0]?.text) reply = last.content[0].text;
    }

    // 5. Fallback if no reply found
    if (!reply) reply = "⚠️ Workflow executed but did not return a final answer.";

    res.json({ reply });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ reply: "Server error." });
  }
});


// Important: ensure Railway exposes your port
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});
