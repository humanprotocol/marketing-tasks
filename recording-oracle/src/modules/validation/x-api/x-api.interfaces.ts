export interface XApiUser {
  id: string;
  username: string;
}

export interface XApiTweet {
  id: string;
  author_id?: string;
  conversation_id?: string;
  referenced_tweets?: Array<{
    type: string;
    id: string;
  }>;
}

export interface XApiListResponse<T> {
  data?: T[];
  includes?: {
    users?: XApiUser[];
  };
  meta?: {
    next_token?: string;
  };
  error?: {
    message?: string;
  };
  errors?: Array<{
    code?: string;
    title?: string;
    detail?: string;
    message?: string;
    status?: number;
  }>;
}

export interface XApiErrorResponse {
  title?: string;
  detail?: string;
  message?: string;
  error?: {
    message?: string;
  };
  errors?: Array<{
    code?: string;
    title?: string;
    detail?: string;
    message?: string;
    status?: number;
  }>;
}

export type EngagementMatches = {
  likingUsernames: Set<string>;
  repostingUsernames: Set<string>;
  quotingUsernames: Set<string>;
  commentingUsernames: Set<string>;
};
