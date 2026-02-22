# openfeedback-changelog-action

A GitHub Action for the OpenFeedback Engine that automates the release process. It scans your Git history for commits referencing OpenFeedback suggestion IDs (e.g., `fixes #UUID`), generates a markdown changelog, and pushes the data to your Supabase Edge Function to mark the suggestions as "shipped".

## Usage

```yaml
name: Release Workflow

on:
  release:
    types: [published]

jobs:
  openfeedback-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required to scan git history
      
      - name: OpenFeedback Release
        uses: openfeedback/changelog-action@v1
        with:
          version: ${{ github.ref_name }}
          # Optional: scan since the last tag. If omitted, scans everything.
          # since: ${{ github.event.release.previous_tag_name || '' }}
          supabase_url: ${{ secrets.OPENFEEDBACK_API_URL }}
          supabase_service_key: ${{ secrets.OPENFEEDBACK_SERVICE_KEY }}
          project_id: ${{ secrets.OPENFEEDBACK_PROJECT_ID }}
```

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `version` | Yes | | The release version (e.g., `v1.2.0`) |
| `supabase_url` | Yes | | The Supabase API URL |
| `supabase_service_key` | Yes | | The Supabase Service Role Key |
| `project_id` | Yes | | The OpenFeedback Project ID |
| `since` | No | | Start scanning from this git ref or date |
| `until` | No | `HEAD` | End scanning at this git ref |
