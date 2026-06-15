import { Injectable } from '@nestjs/common';
import { HTTPError, LinkdAPI, LinkdAPIError } from 'linkdapi';

import { LinkdapiConfigService } from '../../../common/config/linkdapi-config.service';
import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../../common/constants/errors';
import { ServerError, ValidationError } from '../../../common/errors';
import { ISocialMediaEngagementManifest } from '../../../common/interfaces/job';
import { SubmissionEntity } from '../../submission/submission.entity';
import type { SubmissionValidationResult } from '../validation.service';
import {
  LinkdapiEngagementItem,
  LinkdapiPaginatedData,
  LinkdapiPaginatedRequestOptions,
  LinkdapiPostCommentsData,
  LinkdapiPostLikesData,
  LinkdapiResponse,
} from './linkdapi.interfaces';

@Injectable()
export class LinkdapiService {
  private readonly api?: LinkdAPI;

  constructor(private readonly linkdapiConfigService: LinkdapiConfigService) {
    const apiKey = this.linkdapiConfigService.apiKey;

    if (apiKey) {
      this.api = new LinkdAPI({
        apiKey,
        baseUrl: this.linkdapiConfigService.baseUrl,
      });
    }
  }

  async validateSubmissions(
    submissions: SubmissionEntity[],
    manifest: ISocialMediaEngagementManifest,
  ): Promise<SubmissionValidationResult[]> {
    if (manifest.requirements.checkRepost || manifest.requirements.checkQuote) {
      throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
        'LinkedIn engagement supports only checkLike and checkComment',
      ]);
    }

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
      submissions.flatMap((submission) =>
        this.getProfileMatchKeys(submission.solution),
      ),
    );
    const matches = {
      likingUsers: new Set<string>(),
      commentingUsers: new Set<string>(),
    };
    let candidates = new Set(targetUsers);

    try {
      if (manifest.requirements.checkLike) {
        matches.likingUsers = await this.getLikingUsers(
          targetPostUrn,
          candidates,
        );
        candidates = new Set(
          [...candidates].filter((user) => matches.likingUsers.has(user)),
        );
      }

      if (manifest.requirements.checkComment && candidates.size > 0) {
        matches.commentingUsers = await this.getCommentingUsers(
          targetPostUrn,
          candidates,
        );
      }

      return submissions.map((submission) => {
        const userKeys = this.getProfileMatchKeys(submission.solution);
        let rejectionReason: SubmissionRejectionReason | null = null;

        if (
          manifest.requirements.checkLike &&
          !userKeys.some((user) => matches.likingUsers.has(user))
        ) {
          rejectionReason = SubmissionRejectionReason.MissingRequiredLike;
        } else if (
          manifest.requirements.checkComment &&
          !userKeys.some((user) => matches.commentingUsers.has(user))
        ) {
          rejectionReason = SubmissionRejectionReason.MissingRequiredComment;
        }

        return {
          submission,
          rejectionReason,
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

  async getLikingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    if (targetUsers.size === 0) {
      return new Set<string>();
    }

    const api = this.ensureApi();

    const items = await this.requestPaginatedData({
      operationName: 'getPostLikes',
      pageSize: 10,
      useCursor: false,
      request: ({ start }) =>
        api.getPostLikes(postUrn, start) as Promise<
          LinkdapiResponse<LinkdapiPostLikesData>
        >,
      selectItems: (data) => data.likes ?? [],
      shouldStop: (items) => this.hasAllTargetUsers(items, targetUsers),
    });

    return this.getMatchingUsers(items, targetUsers);
  }

  async getCommentingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    if (targetUsers.size === 0) {
      return new Set<string>();
    }

    const api = this.ensureApi();

    const items = await this.requestPaginatedData({
      operationName: 'getPostComments',
      pageSize: this.linkdapiConfigService.pageSize,
      useCursor: true,
      request: ({ start, cursor }) =>
        api.getPostComments(
          postUrn,
          start,
          this.linkdapiConfigService.pageSize,
          cursor,
        ) as Promise<LinkdapiResponse<LinkdapiPostCommentsData>>,
      selectItems: (data) => data.comments ?? [],
      shouldStop: (items) => this.hasAllTargetUsers(items, targetUsers),
    });

    return this.getMatchingUsers(items, targetUsers);
  }

  getTargetPostUrn(postUrl?: string): string | null {
    return this.extractPostUrn(postUrl);
  }

  private async requestPaginatedData<T extends LinkdapiPaginatedData, TItem>({
    operationName,
    pageSize,
    useCursor,
    request,
    selectItems,
    shouldStop,
  }: LinkdapiPaginatedRequestOptions<T, TItem>): Promise<TItem[]> {
    const allItems: TItem[] = [];
    let start = 0;
    let cursor = '';

    try {
      for (
        let page = 0;
        page < this.linkdapiConfigService.maxPagesPerAction;
        page += 1
      ) {
        const payload = await request({ start, cursor });

        if (payload.success === false) {
          if (allItems.length > 0) {
            return allItems;
          }

          const details = payload.message ?? payload.detail;
          throw new ServerError(
            details
              ? `LinkdAPI ${operationName} failed: ${details}`
              : `LinkdAPI ${operationName} failed`,
          );
        }

        const data =
          payload && typeof payload === 'object' && 'data' in payload
            ? (payload.data as T)
            : (payload as T);
        const items = selectItems(data);

        if (items.length === 0) {
          break;
        }

        allItems.push(...items);
        if (shouldStop?.(allItems)) {
          break;
        }

        const record =
          data && typeof data === 'object'
            ? (data as Record<string, unknown>)
            : {};
        const pagination =
          record.pagination && typeof record.pagination === 'object'
            ? (record.pagination as Record<string, unknown>)
            : {};
        const cursorValue =
          record.cursor ??
          record.nextCursor ??
          record.next_cursor ??
          pagination.cursor ??
          pagination.nextCursor;
        const nextCursor =
          typeof cursorValue === 'string' && cursorValue.length > 0
            ? cursorValue
            : null;
        const currentPage =
          typeof record.currentPage === 'number' ? record.currentPage : null;
        const pages = typeof record.pages === 'number' ? record.pages : null;

        if (
          items.length < pageSize ||
          (currentPage !== null && pages !== null && currentPage >= pages)
        ) {
          break;
        }

        if (useCursor && nextCursor && nextCursor !== cursor) {
          cursor = nextCursor;
        } else {
          start += pageSize;
          cursor = '';
        }
      }

      return allItems;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      if (error instanceof HTTPError) {
        if (error.statusCode === 404) {
          if (allItems.length > 0) {
            return allItems;
          }

          throw new ValidationError(
            SubmissionRejectionReason.TargetPostNotFound,
          );
        }

        throw new ServerError(
          error.responseBody
            ? `LinkdAPI ${operationName} failed with HTTP ${error.statusCode}: ${error.responseBody}`
            : `LinkdAPI ${operationName} failed with HTTP ${error.statusCode}`,
        );
      }

      if (error instanceof LinkdAPIError) {
        throw new ServerError(
          `LinkdAPI ${operationName} failed: ${error.message}`,
        );
      }

      throw error;
    }
  }

  private getMatchingUsers(
    items: LinkdapiEngagementItem[],
    targetUsers: Set<string>,
  ): Set<string> {
    const matches = new Set<string>();

    for (const item of items) {
      const profile =
        [
          item.author,
          item.actor,
          item.profile,
          item.user,
          item.commenter,
          item.creator,
          item.member,
          item,
        ].find((candidate) => candidate && typeof candidate === 'object') ??
        null;

      if (!profile) {
        continue;
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
        if (!key) {
          return;
        }

        const matchedKey = this.getProfileMatchKeys(key).find((matchKey) =>
          targetUsers.has(matchKey),
        );
        if (matchedKey) {
          matches.add(matchedKey);
        }
      });
    }

    return matches;
  }

  private hasAllTargetUsers(
    items: LinkdapiEngagementItem[],
    targetUsers: Set<string>,
  ): boolean {
    return this.getMatchingUsers(items, targetUsers).size === targetUsers.size;
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
    return (slug ?? value).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private getProfileMatchKeys(value: string): string[] {
    const normalizedValue = this.normalizeSubmittedProfile(value);
    const withoutSpaces = normalizedValue.replace(/\s+/g, '');
    return [...new Set([normalizedValue, withoutSpaces])];
  }

  private ensureApi(): LinkdAPI {
    if (!this.api) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    return this.api;
  }

  private profileFromUrl(url?: string): string | null {
    if (!url) {
      return null;
    }

    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1] ?? null;
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
}
