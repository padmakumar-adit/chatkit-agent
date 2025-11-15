import express from "express";
import fetch from "node-fetch";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    const openaiResp = await fetch(
      `https://api.openai.com/v1/agents/${process.env.AGENT_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await openaiResp.json();
    console.log("RAW:", JSON.stringify(data, null, 2));

    let reply =
      data?.output_text ??
      data?.messages?.[data.messages.length - 1]?.content?.[0]?.text ??
      "⚠️ No reply generated from Agent.";

    res.json({ reply });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ reply: "Server error." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});
