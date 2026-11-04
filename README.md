# Faro — Guiando tu camino

Bilingual (ES/EN) assistant that explains the U.S. naturalization process in plain language.

## Deploy free on Vercel (Hobby plan, non-commercial)
1. Create a free GitHub account and a new repository. Upload everything in this folder (keep the `api` and `public` folders).
2. Go to vercel.com, sign up with GitHub, click "Add New > Project", and import the repository. Accept the defaults.
3. Before deploying, open "Environment Variables" and add:
   - Name: ANTHROPIC_API_KEY   Value: your key from console.anthropic.com
4. Click Deploy. You get a free link like faro-yourname.vercel.app.
5. In the Anthropic console, set a monthly spending limit first. The hosting is free; the AI calls are pay-as-you-go.

## Editing Faro's behavior
Faro's rules live in `api/chat.js` (SYSTEM_PROMPT). Page design is in `public/index.html`.
Add official USCIS text to SYSTEM_PROMPT to ground answers. Always re-verify fees and rules on uscis.gov.
