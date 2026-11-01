---
schema: ragbaz.document/1
document:
  title: Business plan publication acceptance fixture
  status: proposal
  visualizations:
    descriptions:
      1: Illustrative annual segment spending in US dollars; authored assumptions, not observed data.
dialects: [paper@1, plan@1, models@1]
settings:
  theme: paper@1
models:
  - id: finance
    title: An illustrative finance scenario
    data:
      market: "Not a verified TAM"
      provenance: "Assumed"
views:
  - id: finance-table
    model: finance
    kind: table
---
# Business plan acceptance fixture

{% callout kind="proposal" title="Evidence boundary" %}
This document is a scenario, not an audited financial statement.
{% /callout %}

{% milestone title="Validate a scenario" status="proposal" %}
Compare the calculated data with the chart and label each assumption.
{% /milestone %}

{% view ref="finance-table" /%}

```chartjs
{"type":"bar","data":{"labels":["Freelance","SMB"],"datasets":[{"label":"Illustrative annual spend USD million","data":[9,72]}]}}
```
