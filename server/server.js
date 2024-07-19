// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { OpenAI } = require("openai");

// const app = express();
// app.use(cors({
//     origin: process.env.FRONTEND_URL // Set this to your frontend's URL in production
//   }));
// app.use(express.json());

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
//   });

// app.post('/generate-example', async (req, res) => {
//   try {
//     const { idea, candidateName } = req.body;
//     const completion = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: [
//         { role: "system", content: "You are a political analyst providing brief, neutral scenario examples based on candidates' ideas for the 2024 US Presidential election. Your examples should be specific, realistic, and illustrative of how the policy might work in practice." },
//         { role: "user", content: `Create a brief, specific scenario example (2-3 sentences) of how ${candidateName}'s idea on "${idea}" might play out in practice if implemented. Be neutral and factual in your description.` }
//     ],
//         temperature: 1,
//         max_tokens: 150,
//         top_p: 1,
//         frequency_penalty: 0,
//         presence_penalty: 0,
//     });
//     res.json({ example: completion.choices[0].message.content.trim() });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'An error occurred while generating the example.' });
//   }
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));