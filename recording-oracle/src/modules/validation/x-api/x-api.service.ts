import { createHmac, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

import { XApiConfigService } from '../../../common/config/x-api-config.service';
import { SubmissionRejectionReason } from '../../../common/constants/errors';
import { ServerError, ValidationError } from '../../../common/errors';
import {
  ISocialMediaEngagementManifest,
  IXApiCredentials,
} from '../../../common/interfaces/job';
import { SubmissionEntity } from '../../submission/submission.entity';
import type { SubmissionValidationResult } from '../validation.service';
import {
  EngagementMatches,
  XApiErrorResponse,
  XApiListResponse,
  XApiTweet,
  XApiUser,
} from './x-api.interfaces';

@Injectable()
export class XApiService {
  constructor(private readonly xApiConfigService: XApiConfigService) {}

  async validateSubmissions(
    submissions: SubmissionEntity[],
    manifest: ISocialMediaEngagementManifest,
  ): Promise<SubmissionValidationResult[]> {
    const targetPostId = this.extractPostId(
      manifest.requirements.targetPostUrl,
    );
    if (!targetPostId) {
      return this.rejectSubmissions(
        submissions,
        SubmissionRejectionReason.TargetPostNotFound,
      );
    }

    const targetUsernames = new Set(
      submissions.map((submission) => submission.solution.toLowerCase()),
    );
    const jobCredentials = manifest.requirements.xApiCredentials;

    try {
      const matches: EngagementMatches = {
        likingUsernames: new Set<string>(),
        repostingUsernames: new Set<string>(),
        quotingUsernames: new Set<string>(),
        commentingUsernames: new Set<string>(),
      };
      let candidates = new Set(targetUsernames);

      if (manifest.requirements.checkLike && jobCredentials) {
        matches.likingUsernames = await this.getLikingUsernames(
          targetPostId,
          candidates,
          jobCredentials,
        );
        candidates = this.filterCandidates(candidates, matches.likingUsernames);
      }

      if (manifest.requirements.checkRepost && candidates.size > 0) {
        matches.repostingUsernames = await this.getRepostingUsernames(
          targetPostId,
          candidates,
          jobCredentials,
        );
        candidates = this.filterCandidates(
          candidates,
          matches.repostingUsernames,
        );
      }

      if (manifest.requirements.checkQuote && candidates.size > 0) {
        matches.quotingUsernames = await this.getQuotingUsernames(
          targetPostId,
          candidates,
          jobCredentials,
        );
        candidates = this.filterCandidates(
          candidates,
          matches.quotingUsernames,
        );
      }

      if (manifest.requirements.checkComment && candidates.size > 0) {
        matches.commentingUsernames = await this.getCommentingUsernames(
          targetPostId,
          candidates,
          jobCredentials,
        );
      }

      return submissions.map((submission) => {
        const username = submission.solution.toLowerCase();

        return {
          submission,
          rejectionReason: this.getRejectionReason(username, manifest, matches),
        };
      });
    } catch (error) {
      if (
        error instanceof ValidationError &&
        error.message === SubmissionRejectionReason.TargetPostNotFound
      ) {
        return this.rejectSubmissions(
          submissions,
          SubmissionRejectionReason.TargetPostNotFound,
        );
      }
      throw error;
    }
  }

  getLikingUsernames(
    tweetId: string,
    targetUsernames: Set<string>,
    credentials?: IXApiCredentials,
  ): Promise<Set<string>> {
    return this.collectPaginatedMatches<XApiUser>(
      `/tweets/${tweetId}/liking_users`,
      targetUsernames,
      (user) => user.username.toLowerCase(),
      {
        'user.fields': 'username,name',
      },
      credentials,
    );
  }

  getRepostingUsernames(
    tweetId: string,
    targetUsernames: Set<string>,
    credentials?: IXApiCredentials,
  ): Promise<Set<string>> {
    return this.collectPaginatedMatches<XApiUser>(
      `/tweets/${tweetId}/retweeted_by`,
      targetUsernames,
      (user) => user.username.toLowerCase(),
      {
        'user.fields': 'username,name',
      },
      credentials,
    );
  }

  async getCommentingUsernames(
    tweetId: string,
    targetUsernames: Set<string>,
    credentials?: IXApiCredentials,
  ): Promise<Set<string>> {
    const matches = new Set<string>();

    if (targetUsernames.size === 0) {
      return matches;
    }

    for (const username of targetUsernames) {
      const userMatches = await this.collectPaginatedMatches<XApiTweet>(
        '/tweets/search/recent',
        new Set([username]),
        (tweet, payload) =>
          this.isReplyToTweet(tweet, tweetId)
            ? this.getTweetAuthorUsername(tweet, payload)
            : undefined,
        {
          query: `conversation_id:${tweetId} from:${username}`,
          expansions: 'author_id',
          'tweet.fields': 'author_id,conversation_id,referenced_tweets',
          'user.fields': 'username,name',
        },
        credentials,
      );

      for (const userMatch of userMatches) {
        matches.add(userMatch);
      }
    }

    return matches;
  }

  getQuotingUsernames(
    tweetId: string,
    targetUsernames: Set<string>,
    credentials?: IXApiCredentials,
  ): Promise<Set<string>> {
    return this.collectPaginatedMatches<XApiTweet>(
      `/tweets/${tweetId}/quote_tweets`,
      targetUsernames,
      (tweet, payload) => this.getTweetAuthorUsername(tweet, payload),
      {
        expansions: 'author_id',
        'tweet.fields': 'author_id,created_at,public_metrics',
        'user.fields': 'username,name',
      },
      credentials,
    );
  }

  private async collectPaginatedMatches<T>(
    endpoint: string,
    targetUsernames: Set<string>,
    getUsername: (item: T, payload: XApiListResponse<T>) => string | undefined,
    endpointParams: Record<string, string> = {},
    credentials?: IXApiCredentials,
  ): Promise<Set<string>> {
    const matches = new Set<string>();
    let nextToken: string | undefined;

    if (targetUsernames.size === 0) {
      return matches;
    }

    for (
      let page = 0;
      page < this.xApiConfigService.maxPagesPerAction &&
      matches.size < targetUsernames.size;
      page += 1
    ) {
      const requestParams = {
        ...endpointParams,
        max_results: this.xApiConfigService.pageSize.toString(),
        ...(nextToken ? { pagination_token: nextToken } : {}),
      };
      const payload = await this.xGet<XApiListResponse<T>>(
        endpoint,
        requestParams,
        credentials,
      );
      for (const item of payload.data ?? []) {
        const username = getUsername(item, payload);
        if (username && targetUsernames.has(username)) {
          matches.add(username);
        }
      }

      nextToken = payload.meta?.next_token;
      if (!nextToken) {
        break;
      }
    }

    return matches;
  }

  private getRejectionReason(
    username: string,
    manifest: ISocialMediaEngagementManifest,
    matches: EngagementMatches,
  ): SubmissionRejectionReason | null {
    if (
      manifest.requirements.checkLike &&
      !matches.likingUsernames.has(username)
    ) {
      return SubmissionRejectionReason.MissingRequiredLike;
    }

    if (
      manifest.requirements.checkRepost &&
      !matches.repostingUsernames.has(username)
    ) {
      return SubmissionRejectionReason.MissingRequiredRepost;
    }

    if (
      manifest.requirements.checkQuote &&
      !matches.quotingUsernames.has(username)
    ) {
      return SubmissionRejectionReason.MissingRequiredQuote;
    }

    if (
      manifest.requirements.checkComment &&
      !matches.commentingUsernames.has(username)
    ) {
      return SubmissionRejectionReason.MissingRequiredComment;
    }

    return null;
  }

  private filterCandidates(
    candidates: Set<string>,
    matches: Set<string>,
  ): Set<string> {
    return new Set([...candidates].filter((username) => matches.has(username)));
  }

  private isReplyToTweet(tweet: XApiTweet, tweetId: string): boolean {
    return (
      tweet.id !== tweetId &&
      tweet.conversation_id === tweetId &&
      Boolean(
        tweet.referenced_tweets?.some(
          (reference) => reference.type === 'replied_to',
        ),
      )
    );
  }

  private getTweetAuthorUsername(
    tweet: XApiTweet,
    payload: XApiListResponse<XApiTweet>,
  ): string | undefined {
    if (!tweet.author_id) {
      return undefined;
    }

    const author = payload.includes?.users?.find(
      (user) => user.id === tweet.author_id,
    );

    return author?.username.toLowerCase();
  }

  private rejectSubmissions(
    submissions: SubmissionEntity[],
    rejectionReason: SubmissionRejectionReason,
  ): SubmissionValidationResult[] {
    return submissions.map((submission) => ({
      submission,
      rejectionReason,
    }));
  }

  private extractPostId(postUrl?: string): string | null {
    if (!postUrl) {
      return null;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(postUrl);
    } catch {
      return null;
    }

    const path = parsedUrl.pathname.replace(/\/+$/, '');
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'x.com') {
      return null;
    }
    if (!/^\/[^/]+\/status\/\d+$/.test(path)) {
      return null;
    }

    return path.split('/').pop() ?? null;
  }

  private async xGet<T>(
    endpoint: string,
    params: Record<string, string>,
    credentials?: IXApiCredentials,
  ): Promise<T> {
    const url = new URL(`${this.xApiConfigService.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url, {
      headers: {
        Authorization: this.getOAuthAuthorizationHeader(
          'GET',
          url,
          credentials,
        ),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ValidationError(SubmissionRejectionReason.TargetPostNotFound);
      }

      throw new ServerError(
        await this.getRequestErrorMessage(response, endpoint),
      );
    }

    return (await response.json()) as T;
  }

  private async getRequestErrorMessage(
    response: Response,
    endpoint: string,
  ): Promise<string> {
    const details = this.extractErrorDetails(await response.text());
    const baseMessage = `X API request failed with HTTP ${response.status} for ${endpoint}`;
    const fallbackDetails: Record<number, string> = {
      403: 'Access denied by X API',
      429: 'Rate limit exceeded',
    };
    const serverErrorDetails =
      response.status >= 500 ? 'Temporary X API server error' : null;
    const message =
      details ?? fallbackDetails[response.status] ?? serverErrorDetails;

    return message ? `${baseMessage}: ${message}` : baseMessage;
  }

  private extractErrorDetails(body: string): string | null {
    if (!body.trim()) {
      return null;
    }

    let parsedBody: XApiErrorResponse;
    try {
      parsedBody = JSON.parse(body) as XApiErrorResponse;
    } catch {
      return body.length > 300 ? `${body.slice(0, 300)}...` : body;
    }

    const topLevelMessage =
      parsedBody.error?.message ??
      parsedBody.message ??
      parsedBody.detail ??
      parsedBody.title;
    if (topLevelMessage) {
      return topLevelMessage;
    }

    const errorMessages = parsedBody.errors
      ?.map((error) => error.message ?? error.detail ?? error.title)
      .filter(Boolean);

    return errorMessages?.length ? errorMessages.join('; ') : null;
  }

  private getOAuthAuthorizationHeader(
    method: string,
    url: URL,
    credentials?: IXApiCredentials,
  ): string {
    const oauthCredentials = credentials ?? this.getOAuthCredentials();
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: oauthCredentials.consumerKey,
      oauth_nonce: randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: oauthCredentials.accessToken,
      oauth_version: '1.0',
    };

    oauthParams.oauth_signature = this.getOAuthSignature(
      method,
      url,
      oauthParams,
      oauthCredentials,
    );

    return `OAuth ${Object.entries(oauthParams)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, value]) =>
          `${this.percentEncode(key)}="${this.percentEncode(value)}"`,
      )
      .join(', ')}`;
  }

  private getOAuthSignature(
    method: string,
    url: URL,
    oauthParams: Record<string, string>,
    credentials: IXApiCredentials,
  ): string {
    const allParams: Array<[string, string]> = [];

    for (const [key, value] of url.searchParams.entries()) {
      allParams.push([key, value]);
    }
    for (const [key, value] of Object.entries(oauthParams)) {
      allParams.push([key, value]);
    }

    const parameterString = allParams
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const encodedLeft = `${this.percentEncode(leftKey)}=${this.percentEncode(
          leftValue,
        )}`;
        const encodedRight = `${this.percentEncode(
          rightKey,
        )}=${this.percentEncode(rightValue)}`;
        return encodedLeft.localeCompare(encodedRight);
      })
      .map(
        ([key, value]) =>
          `${this.percentEncode(key)}=${this.percentEncode(value)}`,
      )
      .join('&');
    const baseUrl = `${url.origin}${url.pathname}`;
    const signatureBaseString = [
      method.toUpperCase(),
      this.percentEncode(baseUrl),
      this.percentEncode(parameterString),
    ].join('&');
    const signingKey = `${this.percentEncode(
      credentials.consumerSecret,
    )}&${this.percentEncode(credentials.accessTokenSecret)}`;

    return createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');
  }

  private getOAuthCredentials(): IXApiCredentials {
    const { consumerKey, consumerSecret, accessToken, accessTokenSecret } =
      this.xApiConfigService;

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      throw new ServerError(
        'X API config is required to process social_media_engagement jobs',
      );
    }

    return {
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret,
    };
  }

  private percentEncode(value: string): string {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }
}
