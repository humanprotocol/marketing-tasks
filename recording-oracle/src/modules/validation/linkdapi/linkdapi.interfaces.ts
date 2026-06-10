export type LinkdapiErrorResponse = {
  success?: boolean;
  message?: string;
  error?: string | { message?: string };
  detail?: string;
};

export type LinkdapiResponse<T> = LinkdapiErrorResponse & {
  data?: T;
};

export type LinkdapiProfile = {
  id?: string;
  urn?: string;
  entityUrn?: string;
  profileUrn?: string;
  username?: string;
  publicIdentifier?: string;
  public_identifier?: string;
  url?: string;
  profileUrl?: string;
  profileURL?: string;
  name?: string;
  fullName?: string;
  full_name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
};

export type LinkdapiEngagementItem = LinkdapiProfile & {
  author?: LinkdapiProfile;
  actor?: LinkdapiProfile;
  profile?: LinkdapiProfile;
  user?: LinkdapiProfile;
  commenter?: LinkdapiProfile;
  creator?: LinkdapiProfile;
  member?: LinkdapiProfile;
  header?: string;
  url?: string;
};

export type LinkdapiCollectionPayload = LinkdapiEngagementItem[] &
  Record<string, unknown>;
