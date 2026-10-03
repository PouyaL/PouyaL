# Voice Coworker (React + TypeScript)

Front-end for the DeepOpinion "AI coworker" voice flow, built from the
[Figma prototype](https://www.figma.com/design/l1uafxzpHAAte4ekfdj7DT/AI-voice-component-lib?node-id=38-3332)
(empty start, mic access, listening, transcribing, searching, spoken answer synced to citations,
archive / delete menus).

The data and assistant are scripted demo content: speech recognition is simulated and answers are spoken
with the browser's `speechSynthesis`. No backend or mic permission is needed.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Structure

- `src/hooks/useCoworkerApp.ts` – app state and the voice/answer state machine
- `src/data/` – seeded demo documents and the scripted questions
- `src/components/` – `Shell` (rail, header, coworkers), `Composer`, `Conversation`, `Documents` (library + viewer), `Overlays`
- `src/styles.css` – design tokens (from the Figma variables) and layout
