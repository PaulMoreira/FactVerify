import { OpenAI } from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { idea, candidateName } = req.body;
      const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
              { role: "system", content: "You are a political analyst providing brief, neutral scenario examples based on candidates' ideas for the 2024 US Presidential election. Your examples should be specific, realistic, and illustrative of how the policy might work in practice." },
              { role: "user", content: `Create a brief, specific scenario example (2-3 sentences) of how ${candidateName}'s idea on "${idea}" might play out in practice if implemented. Be neutral and factual in your description.` }
          ],
          temperature: 0.7,
          max_tokens: 150,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
      });
      res.status(200).json({ example: completion.choices[0].message.content.trim() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while generating the example.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}