import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSnackbar } from '../../providers/SnackProvider';
import { useAccount, useWalletClient } from 'wagmi';
import * as jobService from '../../services/job';
import type { AssignmentDetails } from '../../services/job';

type SolutionCopy = {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  helperText: string;
  submitLabel: string;
};

type RequirementItem = {
  label: string;
  value: string;
};

const getBooleanRequirementLabels = (
  requirements: Record<string, unknown>,
): string[] => {
  const labels: Array<[string, string]> = [
    ['checkLike', 'Like'],
    ['checkRepost', 'Repost'],
    ['checkQuote', 'Quote'],
    ['checkComment', 'Comment'],
    ['requiresMedia', 'Media required'],
    ['mustBePublic', 'Public post'],
  ];

  return labels
    .filter(([key]) => requirements[key] === true)
    .map(([, label]) => label);
};

const getPlatformLabel = (platform?: string): string => {
  if (!platform) return 'Social';
  if (platform.toLowerCase() === 'x') return 'X';
  if (platform.toLowerCase() === 'linkedin') return 'LinkedIn';
  return platform;
};

const getStringListRequirement = (
  requirements: Record<string, unknown>,
  key: string,
): string | null => {
  const value = requirements[key];

  return Array.isArray(value) && value.length > 0
    ? value.map(String).join(', ')
    : null;
};

const getPositiveNumberRequirement = (
  requirements: Record<string, unknown>,
  key: string,
): string | null => {
  const value = requirements[key];

  return typeof value === 'number' && value > 0 ? value.toString() : null;
};

const getPostRequirementItems = (
  requirements: Record<string, unknown>,
): RequirementItem[] => {
  const items: RequirementItem[] = [];
  const requiredHashtags = getStringListRequirement(
    requirements,
    'requiredHashtags',
  );
  const requiredKeywords = getStringListRequirement(
    requirements,
    'requiredKeywords',
  );
  const requiredLink =
    typeof requirements.requiredLink === 'string'
      ? requirements.requiredLink
      : null;
  const minLength = getPositiveNumberRequirement(requirements, 'minLength');
  const minLiveDurationHours = getPositiveNumberRequirement(
    requirements,
    'minLiveDurationHours',
  );
  const minFollowers = getPositiveNumberRequirement(
    requirements,
    'minFollowers',
  );
  const minAccountAgeDays = getPositiveNumberRequirement(
    requirements,
    'minAccountAgeDays',
  );
  const minLikes = getPositiveNumberRequirement(requirements, 'minLikes');
  const minReposts = getPositiveNumberRequirement(requirements, 'minReposts');

  if (requiredHashtags) {
    items.push({ label: 'Hashtags', value: requiredHashtags });
  }
  if (requiredKeywords) {
    items.push({ label: 'Keywords', value: requiredKeywords });
  }
  if (requiredLink) {
    items.push({ label: 'Link', value: requiredLink });
  }
  if (minLength) {
    items.push({ label: 'Minimum length', value: `${minLength} characters` });
  }
  if (requirements.requiresMedia === true) {
    items.push({ label: 'Media', value: 'Required' });
  }
  if (requirements.mustBePublic === true) {
    items.push({ label: 'Visibility', value: 'Public post required' });
  }
  if (minLiveDurationHours) {
    items.push({
      label: 'Live duration',
      value: `${minLiveDurationHours} hours`,
    });
  }
  if (minFollowers) {
    items.push({ label: 'Followers', value: `At least ${minFollowers}` });
  }
  if (minAccountAgeDays) {
    items.push({
      label: 'Account age',
      value: `At least ${minAccountAgeDays} days`,
    });
  }
  if (minLikes) {
    items.push({ label: 'Likes', value: `At least ${minLikes}` });
  }
  if (minReposts) {
    items.push({ label: 'Reposts', value: `At least ${minReposts}` });
  }

  return items;
};

const getSolutionCopy = (
  assignment?: AssignmentDetails | null,
): SolutionCopy => {
  const platform = assignment?.platforms?.[0]?.toLowerCase();

  if (assignment?.jobType === 'social_media_engagement') {
    if (platform === 'x') {
      return {
        title: 'Submit X Engagement',
        inputLabel: 'X handle',
        inputPlaceholder: '@human_protocol',
        helperText: 'Enter the X username that engaged with the target post.',
        submitLabel: 'Submit handle',
      };
    }

    if (platform === 'linkedin') {
      return {
        title: 'Submit LinkedIn Engagement',
        inputLabel: 'LinkedIn profile name',
        inputPlaceholder: 'John Doe',
        helperText:
          'Enter the display name from the LinkedIn profile, not the profile URL.',
        submitLabel: 'Submit name',
      };
    }

    return {
      title: 'Submit Engagement',
      inputLabel: 'Social profile',
      inputPlaceholder: 'Your profile handle or URL',
      helperText: 'Enter the profile that completed the required engagement.',
      submitLabel: 'Submit profile',
    };
  }

  if (platform === 'linkedin') {
    return {
      title: 'Submit LinkedIn Post',
      inputLabel: 'Post URL',
      inputPlaceholder: 'https://www.linkedin.com/posts/...',
      helperText: 'Paste the public LinkedIn post URL for this assignment.',
      submitLabel: 'Submit post',
    };
  }

  return {
    title: 'Submit X Post',
    inputLabel: 'Post URL',
    inputPlaceholder: 'https://x.com/username/status/123',
    helperText: 'Paste the public X post URL for this assignment.',
    submitLabel: 'Submit post',
  };
};

const isUrlLikeValue = (value: string): boolean => {
  const trimmedValue = value.trim();

  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue) ||
    /^www\./i.test(trimmedValue) ||
    /(^|\.)linkedin\.com\//i.test(trimmedValue)
  );
};

const SolutionForm: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();

  const { address, chainId, connector, isConnected } = useAccount();
  const { data: signer } = useWalletClient({
    account: address,
    chainId,
    connector,
    query: {
      enabled: isConnected && !!address && !!connector,
    },
  });
  const [solution, setSolution] = useState('');
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const copy = useMemo(() => getSolutionCopy(assignment), [assignment]);
  const platformLabel = getPlatformLabel(assignment?.platforms?.[0]);
  const requirementLabels = useMemo(
    () =>
      assignment?.jobType === 'social_media_engagement'
        ? getBooleanRequirementLabels(assignment.requirements)
        : [],
    [assignment],
  );
  const isXPromotionSubmission =
    assignment?.jobType === 'social_media_promotion' &&
    (assignment.platforms?.[0]?.toLowerCase() ?? 'x') === 'x';
  const postRequirementItems = useMemo(
    () =>
      assignment && isXPromotionSubmission
        ? getPostRequirementItems(assignment.requirements)
        : [],
    [assignment, isXPromotionSubmission],
  );
  const targetPostUrl =
    typeof assignment?.requirements.targetPostUrl === 'string'
      ? assignment.requirements.targetPostUrl
      : null;
  const manifestUrl = assignment?.manifestUrl ?? null;
  const isLinkedInEngagementSubmission =
    assignment?.jobType === 'social_media_engagement' &&
    assignment.platforms?.[0]?.toLowerCase() === 'linkedin';
  const hasInvalidLinkedInName =
    isLinkedInEngagementSubmission && isUrlLikeValue(solution);
  const solutionHelperText = hasInvalidLinkedInName
    ? 'Submit the LinkedIn profile name, for example John Doe. Do not submit a URL.'
    : copy.helperText;

  type SnackbarApi = {
    openSnackbar: (
      message: string,
      severity?: 'success' | 'error' | 'info' | 'warning',
    ) => void;
    showError: (error: unknown) => void;
  };

  const { showError, openSnackbar } = useSnackbar() as SnackbarApi;

  useEffect(() => {
    let isMounted = true;

    const loadAssignment = async () => {
      if (!assignmentId) {
        setIsLoadingAssignment(false);
        setAssignmentError('Missing assignment id');
        return;
      }

      try {
        setIsLoadingAssignment(true);
        const details = await jobService.getAssignmentDetails(assignmentId);
        if (isMounted) {
          setAssignment(details);
          setAssignmentError(null);
        }
      } catch {
        if (isMounted) {
          setAssignmentError('Assignment details could not be loaded.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingAssignment(false);
        }
      }
    };

    loadAssignment();

    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  const handleSubmit = async () => {
    if (!signer) {
      openSnackbar('Please connect your wallet first', 'error');
      return;
    }

    if (!assignmentId) {
      openSnackbar('Missing assignment id', 'error');
      return;
    }

    if (hasInvalidLinkedInName) {
      openSnackbar('Submit the LinkedIn profile name, not a URL', 'error');
      return;
    }

    const message = {
      assignment_id: assignmentId,
      solution,
    };

    try {
      await jobService.solveJob(signer, message);

      openSnackbar('Solution sent successfully', 'success');
    } catch (error) {
      showError(error);
    }
  };

  return (
    <Box
      width="100%"
      maxWidth="680px"
      sx={{
        p: { xs: 3, sm: 4 },
        background: '#271f4f',
        border: '1px solid #3f3569',
        borderRadius: '8px',
        boxShadow: 'none',
      }}
    >
      {isLoadingAssignment ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <CircularProgress size={32} />
          <Typography color="text.secondary">Loading assignment</Typography>
        </Stack>
      ) : (
        <Stack spacing={3}>
          {assignmentError && (
            <Alert severity="warning">{assignmentError}</Alert>
          )}

          <Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Box>
                <Typography variant="h4" color="text.primary">
                  {copy.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Assignment #{assignmentId}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {assignment?.jobType && (
                  <Chip
                    size="small"
                    label={
                      assignment.jobType === 'social_media_engagement'
                        ? 'Engagement'
                        : 'Promotion'
                    }
                  />
                )}
                <Chip size="small" color="primary" label={platformLabel} />
              </Stack>
            </Stack>

            {assignment?.jobDescription && (
              <Box sx={{ mt: 2, textAlign: 'left' }}>
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  fontWeight={800}
                >
                  Description:
                </Typography>
                <Typography
                  variant="body1"
                  color="text.primary"
                  sx={{ mt: 0.5, fontWeight: 700 }}
                >
                  {assignment.jobDescription}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider />

          {(targetPostUrl ||
            requirementLabels.length > 0 ||
            postRequirementItems.length > 0) && (
            <Box
              sx={{
                background: '#211947',
                border: '1px solid #3f3569',
                borderRadius: '8px',
                p: 2,
                textAlign: 'left',
              }}
            >
              <Stack spacing={1.5}>
                {targetPostUrl && (
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Link
                      href={targetPostUrl}
                      target="_blank"
                      rel="noreferrer"
                      display="inline-flex"
                      alignItems="center"
                      gap={0.75}
                      color="primary"
                      sx={{
                        color: '#c7bdff',
                        fontWeight: 800,
                        wordBreak: 'break-word',
                        '&:hover': { color: '#ffffff' },
                      }}
                    >
                      Target post
                      <OpenInNewIcon fontSize="inherit" />
                    </Link>
                  </Stack>
                )}
                {postRequirementItems.length > 0 && (
                  <Stack spacing={1}>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      fontWeight={800}
                    >
                      Post requirements:
                    </Typography>
                    <Stack spacing={1}>
                      {postRequirementItems.map((item) => (
                        <Stack
                          key={item.label}
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={{ xs: 0.25, sm: 1 }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            fontWeight={800}
                            minWidth="132px"
                          >
                            {item.label}:
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.primary"
                            fontWeight={700}
                            sx={{ wordBreak: 'break-word' }}
                          >
                            {item.value}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                )}
                {requirementLabels.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    alignItems="center"
                  >
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      fontWeight={800}
                    >
                      Required actions:
                    </Typography>
                    {requirementLabels.map((label) => (
                      <Chip key={label} size="small" label={label} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          <TextField
            label={copy.inputLabel}
            placeholder={copy.inputPlaceholder}
            variant="outlined"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            error={hasInvalidLinkedInName}
            helperText={solutionHelperText}
            fullWidth
            InputProps={{
              sx: {
                minHeight: 56,
                fontWeight: 700,
              },
            }}
          />

          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={
              !signer ||
              !assignmentId ||
              !solution.trim() ||
              hasInvalidLinkedInName
            }
            startIcon={<SendIcon />}
          >
            {copy.submitLabel}
          </Button>

          {manifestUrl && (
            <Link
              href={manifestUrl}
              target="_blank"
              rel="noreferrer"
              sx={{
                alignSelf: 'center',
                color: '#9b91d4',
                fontSize: '14px',
                fontWeight: 700,
                '&:hover': { color: '#ffffff' },
              }}
            >
              manifest
            </Link>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default SolutionForm;
