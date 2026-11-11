# Estonia Daily 🇪🇪

A short, fun daily Estonian check-in for A1 learners. A single-page, mobile-first web app with a multiple-choice **quiz** and a **dashboard** (activity calendar, progress, dictionary, CSV upload).

- Vite + React + TypeScript, plain CSS
- No backend, no login: everything is stored in the browser's `localStorage`
- Works on iPhone/iPad Safari, supports dark mode, installable as a PWA (Share → Add to Home Screen)

## Setup

Requires Node.js 18+ (20 or 22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

To try it on a phone or iPad on the same Wi-Fi, open the "Network" URL printed by `npm run dev`.

## How it works

1. Upload a CSV (try `public/sample-words.csv`, 30 common A1 words).
2. Answer quiz questions: English → Estonian or Estonian → English, 2–4 options.
3. A word is **learned** after 2 correct answers in a row. It leaves the quiz and joins the dictionary.
4. +10 XP per correct answer, +5 bonus if you said "Yes, I'm sure!" and were right.
5. At most 10 words learned per day (change it in ⚙︎ Settings).

## CSV format

```csv
estonian_word,english_word,sentence_estonian,sentence_english
koer,dog,Minu koer on väike.,My dog is small.
tere,hello,"Tere, mina olen Mari.","Hello, I am Mari."
```

- The header row is required. Header names are case-insensitive and may be in any order.
- `estonian_word` and `english_word` are required; the sentence columns may be empty or missing.
- The delimiter is detected automatically: comma `,` or semicolon `;` (Excel in Estonian/European locales uses `;`).
- UTF-8, with or without BOM. Estonian letters õ ä ö ü š ž work. Windows-1257 files are also understood.
- Quote fields that contain the delimiter, quotes or line breaks: `"Tere, Mari!"`. Escape a quote by doubling it: `""`.
- Empty lines are ignored; whitespace around values is trimmed.
- A word is identified by the **pair** (Estonian + English), case-insensitive. Duplicate pairs are skipped, both within the file and against your library. Homonyms such as `tee,tea` and `tee,road` are separate words.
- After an upload you'll see: *X added, Y duplicates skipped, Z invalid rows* (with row numbers; the header is row 1).

Use **Download template** in the dashboard for an empty file with the right header.

## Deploy

It's a static site: the build output is `dist/`.

### Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo. The framework preset "Vite" is detected (settings are also in `vercel.json`).
3. Build command `npm run build`, output directory `dist`. Deploy.

Or from the CLI: `npx vercel` (then `npx vercel --prod`).

### Netlify

1. In Netlify: **Add new site → Import an existing project**, pick the repo.
2. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`). Deploy.

Or drag and drop the `dist/` folder onto https://app.netlify.com/drop.

PWA install and offline mode need HTTPS, which both hosts provide.

## Data and privacy

All data lives in `localStorage` under the key `estonia-daily:v1` on the device you use. Nothing is uploaded anywhere. Clearing website data in Safari deletes your progress. Different devices or browsers do not share progress.

## Project structure

```
src/
  lib/            pure logic (unit-tested)
    csv.ts        CSV parsing + import with dedupe
    quiz.ts       questions, distractors, scheduling, XP, daily cap, "Are you sure?" flow
    activity.ts   calendar periods, grid day states, streak
    dates.ts      local-time date helpers
    words.ts      word identity, edit/delete/reset
    storage.ts    localStorage load/save with validation
  components/     React UI (Quiz, ActivityGrid, WordCount, Dictionary, UploadCsv, dialogs)
public/
  sample-words.csv, manifest.webmanifest, sw.js, icons
```
