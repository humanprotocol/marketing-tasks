import { Injectable } from '@nestjs/common';

import { LinkdapiConfigService } from '../../../common/config/linkdapi-config.service';
import { SubmissionRejectionReason } from '../../../common/constants/errors';
import { ServerError, ValidationError } from '../../../common/errors';
import { ISocialMediaEngagementManifest } from '../../../common/interfaces/job';
import { SubmissionEntity } from '../../submission/submission.entity';
import type { SubmissionValidationResult } from '../validation.service';
import {
  LinkdapiCollectionPayload,
  LinkdapiEngagementItem,
  LinkdapiErrorResponse,
  LinkdapiProfile,
  LinkdapiResponse,
} from './linkdapi.interfaces';

type EngagementMatches = {
  likingUsers: Set<string>;
  repostingUsers: Set<string>;
  quotingUsers: Set<string>;
  commentingUsers: Set<string>;
};

@Injectable()
export class LinkdapiService {
  constructor(private readonly linkdapiConfigService: LinkdapiConfigService) {}

  async validateSubmissions(
    submissions: SubmissionEntity[],
    manifest: ISocialMediaEngagementManifest,
  ): Promise<SubmissionValidationResult[]> {
    const targetPostUrn = this.extractPostUrn(
      manifest.requirements.targetPostUrl,
    );
    if (!targetPostUrn) {
      return this.rejectSubmissions(
        submissions,
        SubmissionRejectionReason.TargetPostNotFound,
      );
    }

    const targetUsers = new Set(
      submissions.map((submission) =>
        this.normalizeSubmittedProfile(submission.solution),
      ),
    );
    const matches: EngagementMatches = {
      likingUsers: new Set<string>(),
      repostingUsers: new Set<string>(),
      quotingUsers: new Set<string>(),
      commentingUsers: new Set<string>(),
    };
    let candidates = new Set(targetUsers);

    try {
      if (manifest.requirements.checkLike) {
        matches.likingUsers = await this.getLikingUsers(
          targetPostUrn,
          candidates,
        );
        candidates = this.filterCandidates(candidates, matches.likingUsers);
      }

      if (manifest.requirements.checkRepost && candidates.size > 0) {
        matches.repostingUsers = await this.getRepostingUsers(
          targetPostUrn,
          candidates,
        );
        candidates = this.filterCandidates(candidates, matches.repostingUsers);
      }

      if (manifest.requirements.checkQuote && candidates.size > 0) {
        matches.quotingUsers = await this.getQuotingUsers(
          targetPostUrn,
          candidates,
        );
        candidates = this.filterCandidates(candidates, matches.quotingUsers);
      }

      if (manifest.requirements.checkComment && candidates.size > 0) {
        matches.commentingUsers = await this.getCommentingUsers(
          targetPostUrn,
          candidates,
        );
      }

      return submissions.map((submission) => {
        const user = this.normalizeSubmittedProfile(submission.solution);

        return {
          submission,
          rejectionReason: this.getRejectionReason(user, manifest, matches),
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

  getLikingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    return this.collectPaginatedMatches(
      '/api/v1/posts/likes',
      postUrn,
      targetUsers,
      ['likes', 'reactions', 'items', 'elements', 'results', 'data'],
    );
  }

  getCommentingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    return this.collectPaginatedMatches(
      '/api/v1/posts/comments',
      postUrn,
      targetUsers,
      ['comments', 'items', 'elements', 'results', 'data'],
      {
        count: this.linkdapiConfigService.pageSize.toString(),
        sortBy: 'date_posted',
      },
    );
  }

  async getRepostingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    return this.getPostInfoEngagementUsers(postUrn, targetUsers, [
      'reposts',
      'reposters',
      'repostedBy',
      'resharedBy',
      'shares',
      'shareActors',
    ]);
  }

  async getQuotingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    return this.getPostInfoEngagementUsers(postUrn, targetUsers, [
      'quotes',
      'quotePosts',
      'quotedBy',
      'reposts',
      'reposters',
      'repostedBy',
      'resharedBy',
      'shares',
      'shareActors',
    ]);
  }

  private async collectPaginatedMatches(
    endpoint: string,
    postUrn: string,
    targetUsers: Set<string>,
    arrayKeys: string[],
    endpointParams: Record<string, string> = {},
  ): Promise<Set<string>> {
    const matches = new Set<string>();
    let start = 0;
    let cursor: string | null = null;

    if (targetUsers.size === 0) {
      return matches;
    }

    for (
      let page = 0;
      page < this.linkdapiConfigService.maxPagesPerAction &&
      matches.size < targetUsers.size;
      page += 1
    ) {
      const payload = await this.linkdapiGet<LinkdapiCollectionPayload>(
        endpoint,
        {
          urn: postUrn,
          start: start.toString(),
          ...(cursor ? { cursor } : {}),
          ...endpointParams,
        },
      );
      const data = this.getData(payload);
      const items = this.firstArrayAt(data, arrayKeys);

      if (items.length === 0) {
        break;
      }

      this.addMatches(items, targetUsers, matches);

      const nextCursor = this.getCursor(data);
      if (nextCursor && nextCursor !== cursor) {
        cursor = nextCursor;
      } else {
        start += items.length;
        cursor = null;
      }
    }

    return matches;
  }

  private async getPostInfoEngagementUsers(
    postUrn: string,
    targetUsers: Set<string>,
    arrayKeys: string[],
  ): Promise<Set<string>> {
    const matches = new Set<string>();

    if (targetUsers.size === 0) {
      return matches;
    }

    const payload = await this.linkdapiGet<LinkdapiCollectionPayload>(
      '/api/v1/posts/info',
      { urn: postUrn },
    );
    const data = this.getData(payload);
    const items = this.firstArrayAt(data, arrayKeys);
    this.addMatches(items, targetUsers, matches);

    return matches;
  }

  private addMatches(
    items: LinkdapiEngagementItem[],
    targetUsers: Set<string>,
    matches: Set<string>,
  ): void {
    for (const item of items) {
      const userKeys = this.getProfileMatchKeys(item);
      for (const userKey of userKeys) {
        if (targetUsers.has(userKey)) {
          matches.add(userKey);
        }
      }
    }
  }

  private getRejectionReason(
    user: string,
    manifest: ISocialMediaEngagementManifest,
    matches: EngagementMatches,
  ): SubmissionRejectionReason | null {
    if (manifest.requirements.checkLike && !matches.likingUsers.has(user)) {
      return SubmissionRejectionReason.MissingRequiredLike;
    }

    if (
      manifest.requirements.checkRepost &&
      !matches.repostingUsers.has(user)
    ) {
      return SubmissionRejectionReason.MissingRequiredRepost;
    }

    if (manifest.requirements.checkQuote && !matches.quotingUsers.has(user)) {
      return SubmissionRejectionReason.MissingRequiredQuote;
    }

    if (
      manifest.requirements.checkComment &&
      !matches.commentingUsers.has(user)
    ) {
      return SubmissionRejectionReason.MissingRequiredComment;
    }

    return null;
  }

  private filterCandidates(
    candidates: Set<string>,
    matches: Set<string>,
  ): Set<string> {
    return new Set([...candidates].filter((user) => matches.has(user)));
  }

  private extractPostUrn(postUrl?: string): string | null {
    if (!postUrl) {
      return null;
    }

    const decodedUrl = decodeURIComponent(postUrl);
    const urnMatch = decodedUrl.match(
      /urn:li:(?:activity|ugcPost|share):(\d+)/i,
    );
    if (urnMatch) {
      return urnMatch[1];
    }

    const activitySlugMatch = decodedUrl.match(
      /(?:activity|ugcPost|share)-(\d{10,})/i,
    );
    if (activitySlugMatch) {
      return activitySlugMatch[1];
    }

    const numericMatch = decodedUrl.match(/\b(\d{16,})\b/);
    return numericMatch?.[1] ?? null;
  }

  private normalizeSubmittedProfile(value: string): string {
    const slug = this.profileFromUrl(value);
    return (slug ?? value).trim().toLowerCase();
  }

  private getProfileMatchKeys(item: LinkdapiEngagementItem): Set<string> {
    const profile = this.pickProfileObject(item);
    const keys = new Set<string>();

    if (!profile) {
      return keys;
    }

    const url =
      profile.url ?? profile.profileUrl ?? profile.profileURL ?? item.url;
    const username =
      profile.username ??
      profile.publicIdentifier ??
      profile.public_identifier ??
      this.profileFromUrl(url);
    const urn =
      profile.urn ?? profile.profileUrn ?? profile.entityUrn ?? profile.id;
    const firstName = profile.firstName ?? profile.first_name;
    const lastName = profile.lastName ?? profile.last_name;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const profileName =
      profile.name ?? profile.fullName ?? profile.full_name ?? fullName;
    const name =
      profileName ||
      item.header?.replace(
        /\s+(likes|reacted to|commented on|reposted).*/i,
        '',
      );

    [username, url, urn, name].forEach((key) => {
      if (key) {
        keys.add(this.normalizeSubmittedProfile(key));
      }
    });

    return keys;
  }

  private pickProfileObject(
    item: LinkdapiEngagementItem,
  ): LinkdapiProfile | null {
    const candidates = [
      item.author,
      item.actor,
      item.profile,
      item.user,
      item.commenter,
      item.creator,
      item.member,
      item,
    ];

    return (
      candidates.find(
        (candidate) => candidate && typeof candidate === 'object',
      ) ?? null
    );
  }

  private profileFromUrl(url?: string): string | null {
    if (!url) {
      return null;
    }

    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1] ?? null;
  }

  private getData<T>(payload: LinkdapiResponse<T>): T {
    return payload && typeof payload === 'object' && 'data' in payload
      ? (payload.data as T)
      : (payload as T);
  }

  private firstArrayAt(
    data: unknown,
    keys: string[],
  ): LinkdapiEngagementItem[] {
    if (Array.isArray(data)) {
      return data as LinkdapiEngagementItem[];
    }

    if (!data || typeof data !== 'object') {
      return [];
    }

    const record = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as LinkdapiEngagementItem[];
      }
    }

    return [];
  }

  private getCursor(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const pagination =
      record.pagination && typeof record.pagination === 'object'
        ? (record.pagination as Record<string, unknown>)
        : {};
    const cursor =
      record.cursor ??
      record.nextCursor ??
      record.next_cursor ??
      pagination.cursor ??
      pagination.nextCursor;

    return typeof cursor === 'string' && cursor.length > 0 ? cursor : null;
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

  private async linkdapiGet<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<LinkdapiResponse<T>> {
    const apiKey = this.linkdapiConfigService.apiKey;
    if (!apiKey) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    const url = new URL(endpoint, this.linkdapiConfigService.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-linkdapi-apikey': apiKey,
      },
    });
    const text = await response.text();
    const body = this.parseResponseBody(text, endpoint);

    if (!response.ok || body.success === false) {
      if (response.status === 404) {
        throw new ValidationError(SubmissionRejectionReason.TargetPostNotFound);
      }

      throw new ServerError(
        this.getRequestErrorMessage(response.status, endpoint, body),
      );
    }

    return body as LinkdapiResponse<T>;
  }

  private parseResponseBody(
    body: string,
    endpoint: string,
  ): LinkdapiErrorResponse {
    if (!body.trim()) {
      return {};
    }

    try {
      return JSON.parse(body) as LinkdapiErrorResponse;
    } catch {
      throw new ServerError(
        `LinkdAPI returned non-JSON from ${endpoint}: ${body.slice(0, 300)}`,
      );
    }
  }

  private getRequestErrorMessage(
    status: number,
    endpoint: string,
    body: LinkdapiErrorResponse,
  ): string {
    const baseMessage = `LinkdAPI request failed with HTTP ${status} for ${endpoint}`;
    const nestedError =
      body.error && typeof body.error === 'object'
        ? body.error.message
        : body.error;
    const details = body.message ?? nestedError ?? body.detail;

    return details ? `${baseMessage}: ${details}` : baseMessage;
  }
}
