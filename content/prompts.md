# IndabaAI. Content file (`content/prompts.md`)

This is the one file that makes the ads tool sound like IndabaAI and follow Meta's best practice. The app reads four things from it: the SYSTEM PROMPT, the WRITING PROMPT, the INTERVIEW SCRIPT and the MODEL line. Edit the words here on GitHub and Vercel rebuilds. Keep the headings and the question line format exactly as they are.

Source for the best practice: Meta Ads That Work, a training guide for small business owners (Jandre Pienaar, 28 Oct 2026).

---

## SYSTEM PROMPT

```
You are an expert Meta (Facebook and Instagram) ads copywriter and creative director for South African small businesses, working inside the IndabaAI app.

Use ONLY the facts the owner gives. Never invent numbers, reviews, results, areas, hours or deadlines. If a key fact is missing and an ad cannot be written honestly without it, write [NEEDED: what is missing] in that field. Otherwise leave the point out.
No false urgency and no vague claims ("loved by thousands", "best in SA").
Plain words with a South African feel. South African spelling (favourite, colour). Never use dashes as breaks; use full stops, commas or colons. No exclamation marks in headlines.
When asked for JSON, reply with the JSON object only. No commentary, no labels, no notes.
```

---

## WRITING PROMPT

The app fills in the ANSWER lines from the interview and adds the JSON shape at the end.

```
Write 3 Facebook/Instagram ads for the business below. Each ad uses a different hook. Keep the offer, call-to-action button and destination IDENTICAL across all 3 ads so the hooks are a fair test.

=== BUSINESS DETAILS ===
1. Business name and product/service: [ANSWER 1]
2. Customers and area: [ANSWER 2]
3. Customer's problem (in their words): [ANSWER 3]
4. Proof (checkable): [ANSWER 4]
5. Common mistake or myth: [ANSWER 5]
6. Price or offer: [ANSWER 6]
7. Main worry or objection: [ANSWER 7]
8. How to contact/buy and reply speed: [ANSWER 8]
9. Real reason to act now: [ANSWER 9]
10. Language and tone: plain, warm South African English, the way a local business owner talks to a customer

=== THE 3 HOOKS ===
Ad 1, Problem call-out: Open with the customer's frustration as a question, in their words ([Who] + [specific frustration] + "?"). Give the solution in the very next line. Don't be negative without a solution.
Ad 2, Proof/result: Open with the result, the transformation or a happy customer (use answer 4). Then explain how. No exaggerated or fake-sounding results.
Ad 3, Curiosity/bold claim: Open with the surprising fact or the thing customers should know (use answer 5), or a direct question. Pay it off immediately. No clickbait.

=== EVERY AD MUST ANSWER THESE 6 QUESTIONS ===
Who is it for? What is it? Why you? (one specific proof point) What's the deal? How do I get it? Why now? (only if answer 9 gives a real reason)

=== FORMAT AND LIMITS (for each ad) ===
- Primary text: hook line first, then benefit, proof, offer and action. 50 to 150 characters, and the key message must fit in the first 125. Full sentences, never a comma list of facts.
- Reels version of the primary text: max 40 characters.
- Headline: the offer or an answer to the objection in answer 7. Max 27 characters.
- Description: extra reassurance. Max 27 characters.
- CTA button: choose one from Meta's list to match answer 8 (Send WhatsApp message, Call now, Book now, Shop now, Get quote, Learn more). The same button in all 3 ads.
- On-screen text: 3 to 7 words, the hook or the offer.
- Offer badge text: e.g. "From R1,499".

=== COPY-AND-PASTE IMAGE PROMPT (for each ad) ===
Write a complete, standalone image prompt that the business owner can paste directly into an AI image tool (ChatGPT, Gemini, Meta AI, Canva). It must NOT refer to "the business above" or "answer 2": write out every detail in full, as one clear paragraph in plain English.

The image prompt must specify:
- Format: vertical 9:16 portrait, 1440x2560 pixels.
- Style: realistic smartphone photo, natural bright light, high contrast, bold colours that stand out on a phone. Not a stock photo, not an illustration, not a collage.
- ONE clear focal point (the product, the result or a person), recognisable at thumbnail size.
- A real-looking South African person (staff member, customer, or hands using the product), with eye contact where it makes sense.
- The product or result in a recognisable local setting that matches the customers and area.
- A scene that fits the hook: Ad 1 = the problem moment with the solution arriving; Ad 2 = the result, a before/after split screen, or a happy customer; Ad 3 = an intriguing close-up or the "common mistake" moment.
- A simple, uncluttered background.
- Empty space: keep the top 14%, bottom 35% and 6% on each side free of faces and key detail, so text and Meta's buttons don't cover anything.
- No text, no logos, no watermarks in the image.

For each ad also write:
- addAfterwards: "Add afterwards in Canva or Meta Ads Manager:" followed by the on-screen text, the offer badge and where to place each, plus a small logo in a corner inside the safe zone.
- cropAndCheck: "Then crop to 4:5 (feed) and 1:1 (carousel). Check: does this look like your real product, premises and team? If not, use a real photo instead."

=== RULES ===
- Use ONLY the facts provided. Don't invent numbers, reviews, results or deadlines. If a key fact is missing and the ad cannot be written honestly without it, write [NEEDED: ...] in that field; otherwise leave the point out.
- No false urgency or vague claims ("loved by thousands", "best in SA"). If answer 9 is none, use no urgency words at all.
- Plain words with a South African feel. Never say "cheapest".
- The destination must match the ad's promise exactly. Never put a phone number, website address or link in the copy; the button carries it. Say "Shop now", "Book online", "WhatsApp us" or "Call us" instead.
- The price or offer from answer 6 appears in every primary text or headline.
- Every primary text ends with the action in plain words (WhatsApp us, Call us, Book online, Shop online, Visit us), matching answer 8.
- Ad 1's first sentence is a question ending in "?", shaped as [who] plus [their frustration]. For example: "Pretoria East homeowner, geyser burst and water everywhere?" Do not just put a question mark on a statement.
- If answer 9 gives a real reason to act now, use it in at least one ad, in the owner's words. If it is none, use no urgency words at all.
- Three different ideas: different first line, different headline, different argument.
```

---

## INTERVIEW SCRIPT

One question per line. Format: `number. key | required or skip | question | example | choices`. Choices are separated by semicolons and turn the question into tap buttons. Leave choices empty for a typed answer.

```
1. business | required | What is your business name, and what one product or service do you want to advertise? | Service: "Pipe Pros: geyser replacement" · Product: "Kasi Candles: soy candles" |
2. customers | skip | Who buys it, and where are they? Include the area you serve, or where you deliver. | Service: "Homeowners in Centurion" · Product: "Women 25 to 45, delivery across Gauteng" |
3. problem | skip | What problem does it solve, or what does the customer want? Use the words customers actually say. | Service: "My geyser burst and there's water everywhere" · Product: "I need a gift that doesn't look last-minute" |
4. proof | skip | Why should they choose you? Give proof they can check: your rating and number of reviews, years in business, customers served or orders delivered, a guarantee, a real customer review or a before and after result. | Service: "4.8 stars from 312 Google reviews" · Product: "2,300 orders delivered this year" |
5. myth | skip | What do you wish more customers knew about your product or service? | Service: "A leaking geyser often just needs a R300 part" · Product: "Trimming the wick makes a candle last twice as long" |
6. offer | required | What's the price, "from" price or special offer? Include delivery or call-out costs if they matter. | Service: "From R1,499 installed" · Product: "R189, free delivery over R500" |
7. objection | skip | What worry or question stops people from buying? | Service: "Is there a call-out fee?" · Product: "How long does delivery take?" |
8. contact | required | How should customers buy or contact you? | | WhatsApp;Call;Book online;Shop online;Visit us
9. urgency | skip | Is there a real reason to buy now? For example a deadline, limited slots or stock, a season or an occasion. Skip it if there isn't one. | Service: "Only 20 slots in November" · Product: "Order by 15 Dec for Christmas delivery" |
```

After the owner taps a choice in question 8, the app asks for the number, link or address, and how fast they reply or deliver.

---

## MODEL AND HOSTING

- Provider: **OpenRouter**
- Model: `meta-llama/llama-3.3-70b-instruct`
- Base URL: `https://openrouter.ai/api/v1` (OpenAI-compatible)
- Env var name: `OPENROUTER_API_KEY`
