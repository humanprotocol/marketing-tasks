import { Injectable } from '@nestjs/common';
import { HTTPError, LinkdAPI, LinkdAPIError } from 'linkdapi';

import { LinkdapiConfigService } from '../../../common/config/linkdapi-config.service';
import { SubmissionRejectionReason } from '../../../common/constants/errors';
import { ServerError, ValidationError } from '../../../common/errors';
import { ISocialMediaEngagementManifest } from '../../../common/interfaces/job';
import { SubmissionEntity } from '../../submission/submission.entity';
import type { SubmissionValidationResult } from '../validation.service';
import {
  EngagementMatches,
  LinkdapiEngagementItem,
  LinkdapiPostCommentsData,
  LinkdapiPostInfoData,
  LinkdapiPostLikesData,
  LinkdapiProfile,
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

  async getLikingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    if (targetUsers.size === 0) {
      return new Set<string>();
    }

    if (!this.api) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    const matches = new Set<string>();
    let start = 0;

    try {
      for (
        let page = 0;
        page < this.linkdapiConfigService.maxPagesPerAction &&
        matches.size < targetUsers.size;
        page += 1
      ) {
        const payload = (await this.api.getPostLikes(
          postUrn,
          start,
        )) as LinkdapiResponse<LinkdapiPostLikesData>;

        if (payload.success === false) {
          const details = payload.message ?? payload.detail;
          throw new ServerError(
            details
              ? `LinkdAPI getPostLikes failed: ${details}`
              : 'LinkdAPI getPostLikes failed',
          );
        }

        const data = this.getData(payload);
        const items = data.likes ?? [];

        if (items.length === 0) {
          break;
        }

        this.addMatches(items, targetUsers, matches);
        start += items.length;
      }

      return matches;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      if (error instanceof HTTPError) {
        if (error.statusCode === 404) {
          throw new ValidationError(
            SubmissionRejectionReason.TargetPostNotFound,
          );
        }

        throw new ServerError(
          error.responseBody
            ? `LinkdAPI getPostLikes failed with HTTP ${error.statusCode}: ${error.responseBody}`
            : `LinkdAPI getPostLikes failed with HTTP ${error.statusCode}`,
        );
      }

      if (error instanceof LinkdAPIError) {
        throw new ServerError(`LinkdAPI getPostLikes failed: ${error.message}`);
      }

      throw error;
    }
  }

  async getCommentingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    if (targetUsers.size === 0) {
      return new Set<string>();
    }

    if (!this.api) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    const matches = new Set<string>();
    let start = 0;
    let cursor = '';

    try {
      for (
        let page = 0;
        page < this.linkdapiConfigService.maxPagesPerAction &&
        matches.size < targetUsers.size;
        page += 1
      ) {
        const payload = (await this.api.getPostComments(
          postUrn,
          start,
          this.linkdapiConfigService.pageSize,
          cursor,
        )) as LinkdapiResponse<LinkdapiPostCommentsData>;

        if (payload.success === false) {
          const details = payload.message ?? payload.detail;
          throw new ServerError(
            details
              ? `LinkdAPI getPostComments failed: ${details}`
              : 'LinkdAPI getPostComments failed',
          );
        }

        const data = this.getData(payload);
        const items = data.comments ?? [];

        if (items.length === 0) {
          break;
        }

        this.addMatches(items, targetUsers, matches);

        const nextCursor = this.getCursor(data);
        if (nextCursor && nextCursor !== cursor) {
          cursor = nextCursor;
        } else {
          start += items.length;
          cursor = '';
        }
      }

      return matches;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      if (error instanceof HTTPError) {
        if (error.statusCode === 404) {
          throw new ValidationError(
            SubmissionRejectionReason.TargetPostNotFound,
          );
        }

        throw new ServerError(
          error.responseBody
            ? `LinkdAPI getPostComments failed with HTTP ${error.statusCode}: ${error.responseBody}`
            : `LinkdAPI getPostComments failed with HTTP ${error.statusCode}`,
        );
      }

      if (error instanceof LinkdAPIError) {
        throw new ServerError(
          `LinkdAPI getPostComments failed: ${error.message}`,
        );
      }

      throw error;
    }
  }

  async getRepostingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    const matches = new Set<string>();

    if (targetUsers.size === 0) {
      return matches;
    }

    if (!this.api) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    try {
      const payload = (await this.api.getPostInfo(
        postUrn,
      )) as LinkdapiResponse<LinkdapiPostInfoData>;

      if (payload.success === false) {
        const details = payload.message ?? payload.detail;
        throw new ServerError(
          details
            ? `LinkdAPI getPostInfo failed: ${details}`
            : 'LinkdAPI getPostInfo failed',
        );
      }

      const data = this.getData(payload);
      const items =
        data.reposts ??
        data.reposters ??
        data.repostedBy ??
        data.resharedBy ??
        data.shares ??
        data.shareActors ??
        [];
      this.addMatches(items, targetUsers, matches);

      return matches;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      if (error instanceof HTTPError) {
        if (error.statusCode === 404) {
          throw new ValidationError(
            SubmissionRejectionReason.TargetPostNotFound,
          );
        }

        throw new ServerError(
          error.responseBody
            ? `LinkdAPI getPostInfo failed with HTTP ${error.statusCode}: ${error.responseBody}`
            : `LinkdAPI getPostInfo failed with HTTP ${error.statusCode}`,
        );
      }

      if (error instanceof LinkdAPIError) {
        throw new ServerError(`LinkdAPI getPostInfo failed: ${error.message}`);
      }

      throw error;
    }
  }

  async getQuotingUsers(
    postUrn: string,
    targetUsers: Set<string>,
  ): Promise<Set<string>> {
    const matches = new Set<string>();

    if (targetUsers.size === 0) {
      return matches;
    }

    if (!this.api) {
      throw new ServerError(
        'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
      );
    }

    try {
      const payload = (await this.api.getPostInfo(
        postUrn,
      )) as LinkdapiResponse<LinkdapiPostInfoData>;

      if (payload.success === false) {
        const details = payload.message ?? payload.detail;
        throw new ServerError(
          details
            ? `LinkdAPI getPostInfo failed: ${details}`
            : 'LinkdAPI getPostInfo failed',
        );
      }

      const data = this.getData(payload);
      const items =
        data.quotes ??
        data.quotePosts ??
        data.quotedBy ??
        data.reposts ??
        data.reposters ??
        data.repostedBy ??
        data.resharedBy ??
        data.shares ??
        data.shareActors ??
        [];
      this.addMatches(items, targetUsers, matches);

      return matches;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }

      if (error instanceof HTTPError) {
        if (error.statusCode === 404) {
          throw new ValidationError(
            SubmissionRejectionReason.TargetPostNotFound,
          );
        }

        throw new ServerError(
          error.responseBody
            ? `LinkdAPI getPostInfo failed with HTTP ${error.statusCode}: ${error.responseBody}`
            : `LinkdAPI getPostInfo failed with HTTP ${error.statusCode}`,
        );
      }

      if (error instanceof LinkdAPIError) {
        throw new ServerError(`LinkdAPI getPostInfo failed: ${error.message}`);
      }

      throw error;
    }
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
}
