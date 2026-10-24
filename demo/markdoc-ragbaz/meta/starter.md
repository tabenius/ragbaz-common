---
schema: ragbaz.document/1
document:
  title: Your paper title
  status: draft
  # Add the actual authors and roles; do not infer contributors from the template.
  # authors: [{name: 'Author name', role: 'Actual contribution'}]
  # manuscript: {received: 'YYYY-MM-DD', review: pending}
dialects: [paper@1, plan@1, models@1]
settings:
  theme: paper@1
sources: []
---

# Your paper title

## Abstract

State the problem, contribution, evidence and limits for a reader who was not
part of the authoring conversation.

## Background

Introduce unfamiliar systems before asking the reader to interpret their
implementation details. Add sources with meaningful titles and immutable URLs.

## Methods

Describe what was done and distinguish observations from proposals.

## Findings and limitations

Describe what the evidence establishes—and what it does not.

## References

Add declared sources and cite them using Markdoc source tags. The template
constructs compact numbered references and explanatory cards from those declarations.
