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

export type LinkdapiPagination = {
  cursor?: string;
  nextCursor?: string;
  next_cursor?: string;
};

export type LinkdapiPaginatedData = {
  cursor?: string;
  nextCursor?: string;
  next_cursor?: string;
  pagination?: LinkdapiPagination;
  currentPage?: number;
  pages?: number;
};

export type LinkdapiPostLikesData = LinkdapiPaginatedData & {
  likes?: LinkdapiEngagementItem[];
};

export type LinkdapiPostCommentsData = LinkdapiPaginatedData & {
  comments?: LinkdapiEngagementItem[];
};

export type LinkdapiPageRequest = {
  start: number;
  cursor: string;
};

export type LinkdapiPaginatedRequest<T extends LinkdapiPaginatedData> = (
  page: LinkdapiPageRequest,
) => Promise<LinkdapiResponse<T>>;

export type LinkdapiPaginatedRequestOptions<
  T extends LinkdapiPaginatedData,
  TItem,
> = {
  operationName: string;
  pageSize: number;
  useCursor: boolean;
  request: LinkdapiPaginatedRequest<T>;
  selectItems: (data: T) => TItem[];
  shouldStop?: (items: TItem[]) => boolean;
};
