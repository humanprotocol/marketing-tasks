import { createMock } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { RequestWithUser } from '../../common/types/jwt';
import {
  GetAssignmentsDto,
  CreateAssignmentDto,
  ResignDto,
} from './assignment.dto';
import { AssignmentStatus, JobType } from '../../common/enums/job';
import { MOCK_ADDRESS, MOCK_EXCHANGE_ORACLE } from '../../../test/constants';

jest.mock('../../common/utils/signature');

describe('assignmentController', () => {
  let assignmentController: AssignmentController;
  let assignmentService: AssignmentService;
  const escrowAddress = '0x1234567890123456789012345678901234567890';
  const userAddress = '0x1234567890123456789012345678901234567891';
  const reputationNetwork = '0x1234567890123456789012345678901234567892';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [AssignmentController],
      providers: [
        {
          provide: AssignmentService,
          useValue: createMock<AssignmentService>(),
        },
      ],
    }).compile();

    assignmentController =
      moduleRef.get<AssignmentController>(AssignmentController);
    assignmentService = moduleRef.get<AssignmentService>(AssignmentService);
  });

  describe('getAssignmentList', () => {
    describe('succeed', () => {
      it('should call assignmentService.getAssignmentList', async () => {
        const query: GetAssignmentsDto = {
          chainId: 80002,
          jobType: JobType.SOCIAL_MEDIA_PROMOTION,
          escrowAddress: escrowAddress,
          status: AssignmentStatus.ACTIVE,
          skip: 1,
        };
        const expectedResult = {
          page: 0,
          pageSize: 0,
          totalPages: 0,
          totalResults: 0,
          results: [],
        };
        jest
          .spyOn(assignmentService, 'getAssignmentList')
          .mockResolvedValue(expectedResult);

        const result = await assignmentController.getAssignments(query, {
          user: { address: userAddress, reputationNetwork: reputationNetwork },
          headers: { referer: MOCK_EXCHANGE_ORACLE },
        } as any);
        expect(result).toBe(expectedResult);
        expect(assignmentService.getAssignmentList).toHaveBeenCalledWith(
          query,
          userAddress,
          reputationNetwork,
        );
      });
    });
  });

  describe('createAssignment', () => {
    describe('succeed', () => {
      it('should call assignmentService.createAssignment', async () => {
        const body: CreateAssignmentDto = {
          chainId: 80002,
          escrowAddress: escrowAddress,
        };
        jest.spyOn(assignmentService, 'createAssignment').mockResolvedValue({
          id: 1,
          workerAddress: MOCK_ADDRESS,
          job: { rewardToken: 'HMT' },
        } as any);
        await assignmentController.createAssignment(body, {
          user: { address: userAddress },
        } as RequestWithUser);
        expect(assignmentService.createAssignment).toHaveBeenCalledWith(body, {
          address: userAddress,
        });
      });
    });
  });

  describe('getAssignmentDetails', () => {
    it('should call assignmentService.getAssignmentDetails', async () => {
      const assignmentDetails = {
        assignmentId: '123',
        escrowAddress,
        chainId: 80002,
        jobType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
        status: AssignmentStatus.ACTIVE,
        rewardAmount: 1,
        rewardToken: 'HMT',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobDescription: 'Like the target X post.',
        manifestUrl: 'https://example.com/manifest.json',
        platforms: ['x'],
        requirements: { targetPostUrl: 'https://x.com/test/status/123' },
      };
      jest
        .spyOn(assignmentService, 'getAssignmentDetails')
        .mockResolvedValue(assignmentDetails);

      const result = await assignmentController.getAssignmentDetails('123');

      expect(result).toBe(assignmentDetails);
      expect(assignmentService.getAssignmentDetails).toHaveBeenCalledWith(123);
    });
  });

  describe('resignJob', () => {
    describe('succeed', () => {
      it('should call jobService.resignJob', async () => {
        const assignmentId = 123;
        const resignJobDto: ResignDto = {
          assignmentId: assignmentId.toString(),
        };

        jest.spyOn(assignmentService, 'resign').mockResolvedValue();

        await assignmentController.resign(resignJobDto, {
          user: { address: userAddress },
        } as RequestWithUser);

        expect(assignmentService.resign).toHaveBeenCalledWith(
          assignmentId,
          userAddress,
        );
      });
    });
  });
});
