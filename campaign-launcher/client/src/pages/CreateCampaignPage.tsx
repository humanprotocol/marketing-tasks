import {
  Alert,
  type AlertColor,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';

import {
  EngagementFields,
  GeneralDataStep,
  JobTypeStep,
  PlatformStep,
  PromotionFields,
  SummaryStep,
} from '@/components/campaign/CampaignSteps';
import LaunchProgressDialog from '@/components/campaign/LaunchProgressDialog';
import Shell from '@/components/layout/Shell';
import { MAX_MANIFEST_PREVIEW_LENGTH } from '@/constants';
import {
  getDefaultFundingToken,
  getFundingTokenConfig,
} from '@/constants/fundingTokens';
import { useMarketingEscrow } from '@/hooks/useMarketingEscrow';
import { supportedChains } from '@/providers/wagmiConfig';
import {
  CampaignRequestType,
  SocialPlatform,
  type CampaignFormState,
  type PreparedManifest,
  type RecordingOracleKeyState,
} from '@/types';
import {
  getRecordingOraclePublicKey,
  prepareManifest,
  requiresEncryption,
} from '@/utils/manifest';
import { validateForm } from '@/utils/validation';

const steps = ['Job type', 'Platform', 'General data', 'Details', 'Summary'];

const toDatetimeLocal = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const getDefaultForm = (): CampaignFormState => ({
  chainId: supportedChains[0].id,
  requestType: CampaignRequestType.SOCIAL_MEDIA_PROMOTION,
  platform: SocialPlatform.X,
  campaignName: '',
  campaignDescription: '',
  submissionsRequired: '1',
  endDate: toDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  fundToken: getDefaultFundingToken(supportedChains[0].id),
  fundAmount: '',
  qualifications: '',
  promotion: {
    requiredHashtags: '#humanprotocol',
    requiredKeywords: '',
    requiredLink: '',
    minLength: '',
    requiresMedia: false,
    mustBePublic: true,
    minLiveDurationHours: '24',
    minFollowers: '',
    minAccountAgeDays: '',
    minLikes: '',
    minReposts: '',
    allowedAbuseProbability: 'medium',
  },
  engagement: {
    targetPostUrl: '',
    checkLike: false,
    checkRepost: false,
    checkQuote: false,
    checkComment: true,
    xApiCredentials: {
      consumerKey: '',
      consumerSecret: '',
      accessToken: '',
      accessTokenSecret: '',
    },
  },
});

const recordingOracleKeyIdle: RecordingOracleKeyState = {
  isLoading: false,
  publicKey: '',
};

const CreateCampaignPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<CampaignFormState>(getDefaultForm);
  const [recordingOracleKey, setRecordingOracleKey] =
    useState<RecordingOracleKeyState>(recordingOracleKeyIdle);
  const [preparedManifest, setPreparedManifest] =
    useState<PreparedManifest | null>(null);
  const [prepareError, setPrepareError] = useState<string>('');
  const [toast, setToast] = useState<{
    message: ReactNode;
    open: boolean;
    severity: AlertColor;
  }>({ message: '', open: false, severity: 'error' });
  const [launchModalOpen, setLaunchModalOpen] = useState(false);

  const { chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const escrow = useMarketingEscrow();

  const encryptionRequired = requiresEncryption(form);
  const selectedChain = supportedChains.find(
    (chain) => chain.id === form.chainId,
  );
  const isWrongNetwork = chainId !== form.chainId;
  const manifestPreview = useMemo(() => {
    if (!preparedManifest) return '';
    const value = JSON.stringify(preparedManifest.manifest, null, 2);

    return value.length > MAX_MANIFEST_PREVIEW_LENGTH
      ? `${value.slice(0, MAX_MANIFEST_PREVIEW_LENGTH)}...`
      : value;
  }, [preparedManifest]);

  const resetPreparedState = () => {
    setPreparedManifest(null);
    setPrepareError('');
    escrow.reset();
  };

  const updateForm = <K extends keyof CampaignFormState>(
    key: K,
    value: CampaignFormState[K],
  ) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleChainChange = (chainId: CampaignFormState['chainId']) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      chainId,
      fundToken:
        getFundingTokenConfig(chainId, current.fundToken)?.symbol ||
        getDefaultFundingToken(chainId),
    }));
  };

  const updatePromotion = <K extends keyof CampaignFormState['promotion']>(
    key: K,
    value: CampaignFormState['promotion'][K],
  ) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      promotion: {
        ...current.promotion,
        [key]: value,
      },
    }));
  };

  const updateEngagement = <K extends keyof CampaignFormState['engagement']>(
    key: K,
    value: CampaignFormState['engagement'][K],
  ) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      engagement: {
        ...current.engagement,
        [key]: value,
      },
    }));
  };

  const updateXCredentials = <
    K extends keyof CampaignFormState['engagement']['xApiCredentials'],
  >(
    key: K,
    value: CampaignFormState['engagement']['xApiCredentials'][K],
  ) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      engagement: {
        ...current.engagement,
        xApiCredentials: {
          ...current.engagement.xApiCredentials,
          [key]: value,
        },
      },
    }));
  };

  const handleRequestTypeChange = (requestType: CampaignRequestType) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      requestType,
      platform:
        requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION
          ? SocialPlatform.X
          : current.platform,
    }));
  };

  const handlePlatformChange = (platform: SocialPlatform) => {
    resetPreparedState();
    setForm((current) => ({
      ...current,
      platform,
      engagement: {
        ...current.engagement,
        checkRepost:
          platform === SocialPlatform.LINKEDIN
            ? false
            : current.engagement.checkRepost,
        checkQuote:
          platform === SocialPlatform.LINKEDIN
            ? false
            : current.engagement.checkQuote,
      },
    }));
  };

  const stepErrors = (step: number): string[] => {
    if (step === 0 && !form.requestType) return ['Select a job type'];
    if (step === 1 && !form.platform) return ['Select a platform'];
    if (step === 2) {
      return validateForm({
        ...form,
        promotion: {
          ...form.promotion,
          requiredHashtags: form.promotion.requiredHashtags || '#placeholder',
        },
        engagement: {
          ...form.engagement,
          targetPostUrl: form.engagement.targetPostUrl || 'https://example.com',
          checkComment: true,
        },
      }).filter((error) =>
        [
          'Campaign name is required',
          'Campaign description is required',
          'Submissions required must be greater than zero',
          'End date must be in the future',
          'Selected currency is not configured for this network',
          'Fund amount must be greater than zero',
        ].includes(error),
      );
    }
    if (step === 3) return validateForm(form);
    return [];
  };

  const goNext = () => {
    const validationErrors = stepErrors(activeStep);
    if (validationErrors.length) {
      setToast({
        open: true,
        severity: 'error',
        message: (
          <Stack component="span" gap={0.5}>
            {validationErrors.map((error) => (
              <Box component="span" key={error}>
                {error}
              </Box>
            ))}
          </Stack>
        ),
      });
      return;
    }
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setActiveStep((current) => Math.max(current - 1, 0));
  };

  useEffect(() => {
    let cancelled = false;

    const loadReview = async () => {
      if (activeStep !== 4) return;

      setPreparedManifest(null);
      setPrepareError('');

      if (!encryptionRequired) {
        setRecordingOracleKey(recordingOracleKeyIdle);

        try {
          const prepared = await prepareManifest(form, recordingOracleKeyIdle);
          if (!cancelled) setPreparedManifest(prepared);
        } catch (error) {
          if (!cancelled) {
            setPrepareError(
              error instanceof Error
                ? error.message
                : 'Failed to prepare manifest',
            );
          }
        }
        return;
      }

      setRecordingOracleKey({ ...recordingOracleKeyIdle, isLoading: true });

      const key = await getRecordingOraclePublicKey(
        form.chainId,
        encryptionRequired,
      );

      if (cancelled) return;

      setRecordingOracleKey(key);

      if (key.error) {
        setPrepareError(key.error);
        return;
      }

      try {
        const prepared = await prepareManifest(form, key);
        if (!cancelled) setPreparedManifest(prepared);
      } catch (error) {
        if (!cancelled) {
          setPrepareError(
            error instanceof Error
              ? error.message
              : 'Failed to prepare manifest',
          );
        }
      }
    };

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [activeStep, encryptionRequired, form]);

  const handleLaunch = async () => {
    if (!preparedManifest) return;
    setLaunchModalOpen(true);
    await escrow.launchEscrow({
      chainId: form.chainId,
      fundToken: form.fundToken,
      fundAmount: form.fundAmount,
      preparedManifest,
    });
  };

  const handleCloseLaunchModal = () => {
    setLaunchModalOpen(false);
    navigate('/');
  };

  useEffect(() => {
    if (!prepareError) return;

    setToast({
      open: true,
      severity: 'error',
      message: prepareError,
    });
  }, [prepareError]);

  useEffect(() => {
    if (!escrow.error) return;

    setToast({
      open: true,
      severity: 'error',
      message: escrow.error.message,
    });
  }, [escrow.error]);

  return (
    <Shell>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ color: 'white' }}>
            Create campaign
          </Typography>
          <Typography color="text.secondary">
            Complete each step, then review the final manifest before launch.
          </Typography>
        </Box>
        <Card>
          <CardContent>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {activeStep === 0 && (
              <JobTypeStep form={form} onSelect={handleRequestTypeChange} />
            )}
            {activeStep === 1 && (
              <PlatformStep form={form} onSelect={handlePlatformChange} />
            )}
            {activeStep === 2 && (
              <GeneralDataStep
                form={form}
                updateForm={updateForm}
                onChainChange={handleChainChange}
              />
            )}
            {activeStep === 3 &&
              (form.requestType ===
              CampaignRequestType.SOCIAL_MEDIA_PROMOTION ? (
                <PromotionFields
                  form={form}
                  updatePromotion={updatePromotion}
                />
              ) : (
                <EngagementFields
                  form={form}
                  updateEngagement={updateEngagement}
                  updateXCredentials={updateXCredentials}
                />
              ))}
            {activeStep === 4 && (
              <SummaryStep
                form={form}
                encryptionRequired={encryptionRequired}
                recordingOracleKey={recordingOracleKey}
                preparedManifest={preparedManifest}
                isWrongNetwork={isWrongNetwork}
                isSwitchingChain={isSwitchingChain}
                selectedChainName={selectedChain?.name || ''}
                manifestPreview={manifestPreview}
                onSwitchChain={() => switchChain({ chainId: form.chainId })}
              />
            )}

            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mt: 4 }}
            >
              <Button
                variant="outlined"
                onClick={activeStep === 0 ? () => navigate('/') : goBack}
                disabled={escrow.isLoading}
              >
                {activeStep === 0 ? 'Home' : 'Back'}
              </Button>
              {activeStep < 4 && (
                <Button variant="contained" onClick={goNext}>
                  Continue
                </Button>
              )}
              {activeStep === 4 && (
                <Button
                  variant="contained"
                  disabled={
                    !preparedManifest ||
                    Boolean(prepareError) ||
                    isWrongNetwork ||
                    escrow.isLoading ||
                    Boolean(escrow.result)
                  }
                  onClick={handleLaunch}
                >
                  {escrow.isApproving
                    ? `Approving ${form.fundToken}...`
                    : escrow.isCreating
                      ? 'Creating escrow...'
                      : escrow.isNotifyingExchange
                        ? 'Signing exchange webhook...'
                        : 'Approve and create escrow'}
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={() => setToast((current) => ({ ...current, open: false }))}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast((current) => ({ ...current, open: false }))}
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
        <LaunchProgressDialog
          open={launchModalOpen}
          isApproving={escrow.isApproving}
          isCreating={escrow.isCreating}
          isNotifyingExchange={escrow.isNotifyingExchange}
          error={escrow.error}
          escrowAddress={escrow.result?.escrowAddress}
          onClose={handleCloseLaunchModal}
        />
      </Stack>
    </Shell>
  );
};

export default CreateCampaignPage;
