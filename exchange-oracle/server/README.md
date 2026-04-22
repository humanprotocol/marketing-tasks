# Exchange Oracle

NestJS service used as the base Exchange Oracle for the Social Media Promotion MVP.

Current state:

- derived from the Fortune Exchange Oracle server
- prepared as a standalone subproject inside the monorepo
- exchange client UI removed from this repository

Expected future changes for this MVP:

- accept X post URLs as submissions
- validate URL format
- enforce uniqueness so the same post cannot be claimed more than once
- expose final submission results for downstream oracles
