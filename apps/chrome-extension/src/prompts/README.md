# Prompt Slots

Current prompt chain:
- `prompt1.txt`: job-description extraction
- `prompt2.txt`: compression and prioritization
- `prompt3.txt`: final SOM Career Coach JSON generation

Reserved for future use:
- `prompt4-repair.txt`

Planned purpose of the reserved repair prompt:
- repair malformed or schema-invalid Prompt 3 output
- preserve content as much as possible
- correct structure only
- return valid SOM Career Coach JSON

This repair step is intentionally not implemented yet.
