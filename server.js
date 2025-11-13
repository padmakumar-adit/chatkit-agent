import express from "express";
import fetch from "node-fetch";
import path from "path";
import cookieSession from "cookie-session";

const app = express();
app.use(express.json());

app.use(express.static(path.join(process.cwd(), "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    const openaiResp = await fetch(
      "https://api.openai.com/v1/workflows/" + process.env.AGENT_ID + "/runs",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: { question: message }
        })
      }
    );

    const data = await openaiResp.json();

    const reply = data?.output?.final ?? "No reply generated.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error." });
  }
});

app.listen(process.env.PORT || 3000);
