# JobPilot

JobPilot is the working application for Fyodor's job-search workflow.

## v1 search engine

The first implementation focuses on role discovery and keeps `fdronoff-pr/jobsearch` untouched as a reference/backup.

Search sources:
- Arbeitnow public jobs API
- Remotive public jobs API
- Greenhouse public job boards
- Lever public postings API
- Ashby public job boards

JobPilot normalises results into one schema, deduplicates them, filters for target product roles and UK/remote eligibility, and ranks the shortlist.

## Run

```bash
npm run search -- "product manager"
```

Optional environment variables:

```
JOBPILOT_LOCATION=United Kingdom
JOBPILOT_REMOTE=true
JOBPILOT_LIMIT=50
```

## Next

The search layer will feed the JobPilot web UI, where we will restore Responsibilities, Acceptance, Role Match, Acceptance Match, mismatches and blockers.
