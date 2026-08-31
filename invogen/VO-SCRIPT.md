# InvoGen — 45s Voiceover Script (TTS-ready)

Master: `invogen/index.html` (16:9) · `invogen/reel.html` (9:16)
Total: **45.0s** · 8 lines · English · one voice.

Word counts are set for a **calm 2.4–2.6 words/sec** read. If your TTS comes out faster,
do NOT re-record — pad the gaps, the animation reads from the timestamps, not the audio length.

---

## 1. Timed line sheet

| # | In | Out | Len | Line | Scene it lands on |
|---|----|-----|-----|------|-------------------|
| 1 | 0.6 | 5.0 | 4.4s | Still quoting from last year's Word file? Duplicate, rename, and hope. | Old .docx, wrong name, drifting number |
| 2 | 5.2 | 9.0 | 3.8s | Every quote reopens the same three mistakes. | Three ✕ rows |
| 3 | 9.2 | 14.0 | 4.8s | InvoGen builds the document instead. Quotations, proposals, invoices, bills. | Reveal + chips |
| 4 | 14.2 | 22.0 | 7.8s | Line items, tax, discounts — every total calculated on the server, every time. What you see in the preview is exactly what the PDF prints. | Builder + PDF match |
| 5 | 22.2 | 29.0 | 6.8s | Send a link. Your client opens it, reads it, and signs it right there — no account, no printer, no scanner. | Public link + signature |
| 6 | 29.2 | 35.0 | 5.8s | The moment a quotation is accepted, it becomes an invoice in one click — and the two stay linked. | QKWN005 → IKWN002 |
| 7 | 35.2 | 40.0 | 4.8s | Payments, balances, and every document you've issued — on one dashboard. | Dashboard, chips flip to Paid |
| 8 | 40.2 | 44.8 | 4.6s | InvoGen, by Kwings Media. WhatsApp us to get your own instance set up. | Dark CTA frame |

## 2. Plain script (paste into any TTS, one line per generation)

```
Still quoting from last year's Word file? Duplicate, rename, and hope.

Every quote reopens the same three mistakes.

InvoGen builds the document instead. Quotations, proposals, invoices, bills.

Line items, tax, discounts — every total calculated on the server, every time. What you see in the preview is exactly what the PDF prints.

Send a link. Your client opens it, reads it, and signs it right there — no account, no printer, no scanner.

The moment a quotation is accepted, it becomes an invoice in one click — and the two stay linked.

Payments, balances, and every document you've issued — on one dashboard.

InvoGen, by Kwings Media. WhatsApp us to get your own instance set up.
```

**Generate each line as its own file** (`vo-01.mp3` … `vo-08.mp3`), then lay them on a 45s
timeline at the In-times above. One 45s render is harder to sync and one bad word means
re-rolling the whole thing.

## 3. SSML version (ElevenLabs / Azure / Google / Polly)

Breaks are what make this sound written rather than read. Strip the `<mark>` tags if your
engine rejects them.

```xml
<speak>
  <mark name="l1"/>Still quoting from last year's Word file?<break time="450ms"/>
  Duplicate, rename,<break time="200ms"/> and hope.<break time="700ms"/>

  <mark name="l2"/>Every quote reopens<break time="150ms"/> the same three mistakes.<break time="800ms"/>

  <mark name="l3"/><emphasis level="moderate">InvoGen</emphasis> builds the document instead.<break time="350ms"/>
  Quotations,<break time="120ms"/> proposals,<break time="120ms"/> invoices,<break time="120ms"/> bills.<break time="800ms"/>

  <mark name="l4"/>Line items,<break time="120ms"/> tax,<break time="120ms"/> discounts —<break time="250ms"/>
  every total calculated <emphasis level="moderate">on the server</emphasis>, every time.<break time="500ms"/>
  What you see in the preview<break time="180ms"/> is exactly what the PDF prints.<break time="700ms"/>

  <mark name="l5"/>Send a link.<break time="400ms"/>
  Your client opens it, reads it,<break time="180ms"/> and signs it right there —<break time="300ms"/>
  no account,<break time="150ms"/> no printer,<break time="150ms"/> no scanner.<break time="750ms"/>

  <mark name="l6"/>The moment a quotation is accepted,<break time="250ms"/>
  it becomes an invoice in <emphasis level="moderate">one click</emphasis> —<break time="300ms"/>
  and the two stay linked.<break time="800ms"/>

  <mark name="l7"/>Payments,<break time="120ms"/> balances,<break time="120ms"/>
  and every document you've issued —<break time="280ms"/> on one dashboard.<break time="850ms"/>

  <mark name="l8"/><emphasis level="strong">InvoGen</emphasis>,<break time="200ms"/> by Kwings Media.<break time="450ms"/>
  WhatsApp us to get your own instance set up.
</speak>
```

## 4. Voice direction

- **Tone:** confident, plain, unhurried. A competent colleague explaining a tool — not an
  announcer selling one. No upward inflection, no smile-in-the-voice, no hype.
- **Voice:** neutral or light British/Sri Lankan English, mid-to-low pitch, 28–45 sounding.
  Avoid US-hype presets (ElevenLabs "Adam"/"Antoni" over-sell it). Good picks: ElevenLabs
  **Daniel** or **Charlotte**; Azure **en-GB-RyanNeural** (style `chat`) or **en-IN-PrabhatNeural**.
- **Settings (ElevenLabs v2/v3):** Stability **0.50**, Similarity **0.80**, Style **0.15**,
  Speaker Boost on. Higher Style makes it theatrical; that's the wrong film.
- **Pace:** ~0.95× default. Line 1 is a genuine question — land the question mark, don't sing it.
- **Line 8 is the only line that lifts.** Everything before it is level.

## 5. Pronunciation

| Written | Say | Note |
|---|---|---|
| InvoGen | **IN**-voh-jen | Stress the first syllable. Soft *g*, as in *general* — never "in-VO-gen" or a hard *g*. |
| Kwings | **K'wings** | One syllable, like *wings* with a k. |
| PDF | pee-dee-eff | Letters, not "puddef". |
| WhatsApp | **WOTS**-app | |
| QKWN005 / IKWN002 | *not spoken* | On-screen only. Never read document numbers aloud. |
| invogen.kwingsmedia.com | *not spoken* | On-screen only, line 8. |

If your engine mangles the name, feed it `<phoneme alphabet="ipa" ph="ˈɪnvoʊdʒɛn">InvoGen</phoneme>`,
or spell it `Invo-Jen` in a throwaway take and check it sounds right before generating the rest.

## 6. Mix

- Music bed: calm electronic, no vocal, no drop. Ducked **−12 dB** under every line,
  back up in the gaps, out to silence by 44.8s.
- VO at **−3 dBFS** peak, master to **−14 LUFS** (Meta/YouTube target).
- SFX, three only: soft click at **31.3s** (convert), light tick at **27.2s** (signature done),
  low riser **39.6 → 40.2s** into the CTA. Nothing else.
- 200ms of digital silence at the head and tail so the loop doesn't clip the first word.

## 7. Wiring it into the film

1. Export the mixed track to `assets/invogen/vo.mp3`.
2. In **both** `index.html` and `reel.html`, top of the `<script>`:
   ```js
   var AUDIO=true;
   ```
3. Open the real audio in any editor, read off where each line actually starts, and correct
   `CUES` (caption in/out) and `CUTS` (scene boundaries) to match. Everything else re-times
   from those two arrays — no animation code needs touching.
4. Play with `?cinema`, check the captions land on the words, then hit **Export MP4**.

## 8. 20s paid-ad cutdown

Lines **1, 5, 8** only, re-timed: `0.6–5.0`, `5.4–12.0`, `12.4–19.6`; `CUTS=[0,5,12,20]`
against scenes 0, 4 and 7. Same VO takes, no new recording.
