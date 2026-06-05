# Recording Oracle

NestJS service used as the Recording Oracle for the Social Media Promotion MVP.

Current behavior:

- consumes `submission_in_review` webhooks and stores them in Postgres for async processing
- validates marketing submissions for job types `social_media_promotion` and `social_media_engagement`
- uses Grok structured JSON output to validate X posts
- retries submissions that still do not meet `minLiveDurationHours`
- stores minimal final decisions for `reputation-oracle`

Final result shape:

```json
{
  "workerAddress": "0x...",
  "solution": "https://x.com/.../status/123",
  "status": "accepted | rejected",
  "rejectionReason": "optional_machine_reason",
  "summary": "optional_human_summary"
}
```

Environment highlights:

- `POSTGRES_*` for async job and recheck persistence
- `GROK_API_KEY` for Grok validation
- `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_TOKEN_SECRET` for engagement validation
- `SOCIAL_MEDIA_VALIDATION_MAX_RETRIES` for delayed rechecks
