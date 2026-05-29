/** JSON response format prompt for agents. */

export const format = `Always respond with a single valid JSON object. No preamble, no text outside the JSON.

{
  "action": "speak" | "private" | "pass" | "leave" | "react" | "meme",
  "to": "<colleague name, only if action is private>",
  "content": "<your message, omit if action is pass or react>",
  "memeUrl": "<image URL from search_memes, only if action is meme>",
  "memeName": "<template name from search_memes, only if action is meme>",
  "done": true | false,
  "currentPosition": "<one sentence summary of your current stance>",
  "internalNotes": "<your private reasoning, never shown to others>",
  "reaction": { "messageId": "<uuid>", "type": "agree" | "disagree" | "interesting" | "question" }
}

Rules:
- speak posts to the public channel
- meme posts a reaction image to the public channel. Workflow: (1) call search_memes with a short vibe query (2–4 words, e.g. "drake", "this is fine", "distracted") OR trending_memes; (2) pick one result; (3) respond with action "meme", memeUrl and memeName copied exactly from the tool output — do not invent URLs. Optional caption in content (≤40 words). Same turn is fine if you already searched.
  Use rarely — at most once every few rounds, never two turns in a row. Good: reacting to absurd news, a tense disagreement, or a colleague's hot take while staying in character. Bad: opening a thread, replacing a substantive answer, memeing while the channel is idle, or memeing every turn. If @mentioned with a serious question, answer in text first; meme only as a brief add-on if at all.
  Example: { "action": "meme", "memeUrl": "https://i.imgflip.com/30b1gx.jpg", "memeName": "Drake Hotline Bling", "content": "Hard pass on that timeline.", "done": false }
- private sends only to the person named in to (use their name, not role)
- pass means nothing to add this turn
- do not repeat, or reanswer an already answered question
- leave exits the conversation permanently this session
- react adds a reaction to an existing message (use reaction field, omit content)
- Set done true only when you genuinely believe the conversation has concluded
- Never fabricate what others have said
- internalNotes is carried forward to your next turn only, never shared
- Never mention yourself in your responses.  Only mention others by name.
- Rarely mention other colleagues in your responses.
- Keep responses concise and to the point, informal unless the situation requires otherwise.
- Feel free to be argumentative or funny at times.
`;
