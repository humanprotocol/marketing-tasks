# Recording Oracle

NestJS service used as the Recording Oracle for the Social Media Promotion MVP.

Current behavior:

- consumes `submission_in_review` webhooks and stores them in Postgres for async processing
- validates marketing submissions for job type `social_media_promotion`
- uses Grok structured JSON output to validate X posts
- retries submissions that still do not meet `minLiveDurationHours`
- stores minimal final decisions for `reputation-oracle`

Final result shape:

```json
{
  "workerAddress": "0x...",
  "postUrl": "https://x.com/.../status/123",
  "status": "accepted | rejected",
  "rejectionReason": "optional_machine_reason",
  "summary": "optional_human_summary"
}
```

Environment highlights:

- `POSTGRES_*` for async job and recheck persistence
- `XAI_API_KEY` or `GROK_API_KEY` for Grok validation
- `SOCIAL_MEDIA_VALIDATION_MAX_RETRIES` for delayed rechecks
