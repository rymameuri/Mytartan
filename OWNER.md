# How Scotty’s knowledge layer differs from ChatGPT

Scotty is the first classmate a CMU-Q student texts when they are stressed, bored, lost in a class, or having a rough night. The model is the voice. The campus layer is what ChatGPT does not have.

## Profile-aware referrals
When retrieval is weak on an official fact, Scotty says so once, then names **1–3 people** from `knowledge-base/contacts/contact-map.json`. Selection uses onboarding **major**, **year band** (from `graduationDate`), and **topic**. CS does not get IS offices. Freshmen get Damian Dourado for academic success / registration. Mental-health language gets CaPS-Q only. Emails are copied from existing KB pages. Missing Bio / SIO / crisis numbers stay TODOs.

## CMU-Q grounding
Official answers come from the scraped myCMU-Q / Scotty KB plus key facts. The confidence gate still refuses invented policy, emails, phones, and hours. Situation guides only point at resources that already appear in those files.

## Situation layer
`knowledge-base/situations/` is student-life, not a policy dump: midterms week, homesick / rough night, first week, choosing a minor, quiet vs social study. Synonyms in `data/synonyms.json` map slang (`majlis`, `rough night`, `pick a minor`) onto those topics.

## Eval harness
```bash
npm run test:server
npm run eval:referrals
npm run eval:rag
```

`eval/referral-cases.json` checks intent + the right emails (and that a known fact like StuCo still retrieves above the I-don’t-know threshold). `eval/golden-set.json` checks retrieval files.

Course Tutor stays hidden. Cream UI is unchanged.
