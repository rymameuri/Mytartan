# CMU-Q contact map

Structured referrals for Scotty. **Only contacts attested in existing knowledge-base `.txt` files.**

- Do not invent names, emails, or phone numbers.
- If a real office is mentioned without a contact, omit it and leave a `TODO` in `contact-map.json`.
- This JSON is **not** ingested into RAG (the KB loader only reads `.txt`).
- Server selection (`server/contactMap.js`) returns at most 1–3 matches for the student's major, year band, and topic.

## TODO (not in KB, so omitted)

- Biological Sciences Area Head emails (names appear in `departments/biological-sciences/team.txt` with no addresses)
- Named first-year faculty advisors per student (SIO-only; not in KB)
- Campus emergency / crisis phone numbers (mentioned qualitatively in CaPS pages, no number in KB)
