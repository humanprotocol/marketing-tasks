import { SortDirection } from '../../common/enums/collection';
import { JobSortField, JobStatus, JobType } from '../../common/enums/job';
import { JobEntity } from './job.entity';

export interface JobFilterData {
  chainId?: number;
  escrowAddress?: string;
  status?: JobStatus;
  jobType?: JobType;
  sortField?: JobSortField;
  sort?: SortDirection;
  skip: number;
  pageSize: number;
  reputationNetwork: string;
  createdAfter?: Date;
  updatedAfter?: Date;
}

export interface ListResult {
  entities: JobEntity[];
  itemCount: number;
}
