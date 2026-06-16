import {
  Alert,
  type AlertColor,
  AppBar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';

import AccountDropdown from '@/components/AccountDropdown';
import ConnectWallet from '@/components/ConnectWallet';
import { Field } from '@/components/Field';
import Footer from '@/components/Footer';
import { KeyValue } from '@/components/KeyValue';
import {
  MAX_MANIFEST_PREVIEW_LENGTH,
  ORACLE_ADDRESSES,
  PUBLIC_KEY_SETUP_URL,
} from '@/constants';
import {
  getDefaultFundingToken,
  getFundingTokenConfig,
  getFundingTokenOptions,
} from '@/constants/fundingTokens';
import { useMarketingEscrow } from '@/hooks/useMarketingEscrow';
import { supportedChains } from '@/providers/wagmiConfig';
import {
  CampaignRequestType,
  EscrowFundToken,
  SocialPlatform,
  type CampaignFormState,
  type PreparedManifest,
  type PublicKeysState,
} from '@/types';
import {
  getPublicKeys,
  prepareManifest,
  requiresEncryption,
  shortKeyPreview,
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

const keyStateIdle: PublicKeysState = {
  isLoading: false,
  userPublicKey: '',
  oraclePublicKeys: [],
};

const docsUrl = import.meta.env.VITE_APP_DOCS_URL || 'https://docs.humanprotocol.org';
const stakeUrl =
  import.meta.env.VITE_APP_STAKING_DASHBOARD_URL ||
  'https://dashboard.humanprotocol.org';

const getPublicKeySetupErrorText = (error: string) => {
  if (!PUBLIC_KEY_SETUP_URL) return error;
  return error.replace(`: ${PUBLIC_KEY_SETUP_URL}`, '');
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/create"
        element={
          <ProtectedRoute>
            <CreateCampaignPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const Shell = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { isConnected } = useAccount();
  const location = useLocation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.default',
          borderBottom: '1px solid #433679',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{
              minHeight: { xs: 72, md: 88 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr auto', md: '220px 1fr 220px' },
              gap: 2,
            }}
          >
            <Box
              component={RouterLink}
              to="/"
              sx={{
                color: 'white',
                textDecoration: 'none',
                fontSize: { xs: 34, md: 42 },
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1,
              }}
            >
              Marketing
            </Box>
            <Stack
              direction="row"
              justifyContent="center"
              gap={1}
              sx={{ display: { xs: 'none', md: 'flex' } }}
            >
              <NavLink to="/" active={location.pathname === '/'}>
                Dashboard
              </NavLink>
              <NavLink to={docsUrl} external>
                Support
              </NavLink>
              <NavLink to={stakeUrl} external>
                Stake HMT
              </NavLink>
            </Stack>
            {isConnected ? (
              <Stack direction="row" justifyContent="flex-end" gap={1}>
                <AccountDropdown />
              </Stack>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <ConnectWallet />
              </Stack>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      <Container
        maxWidth="xl"
        sx={{ py: { xs: 3, md: 8 }, flex: 1, width: '100%' }}
      >
        {children}
      </Container>
      <Footer reserveBottomOffset={false} />
    </Box>
  );
};

const NavLink = ({
  to,
  active,
  external,
  disabled,
  children,
}: {
  to: string;
  active?: boolean;
  external?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <Button
    component={external && !disabled ? 'a' : disabled ? 'button' : RouterLink}
    disabled={disabled}
    href={external && !disabled ? to : undefined}
    to={external || disabled ? undefined : to}
    target={external ? '_blank' : undefined}
    rel={external ? 'noreferrer' : undefined}
    sx={{
      px: 2,
      py: 1,
      color: active ? 'white' : '#6b6490',
      bgcolor: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
      '&:hover': {
        color: 'white',
        bgcolor: 'rgba(255, 255, 255, 0.08)',
      },
    }}
  >
    {children}
  </Button>
);

const HomePage = () => {
  const { isConnected } = useAccount();

  return (
    <Shell>
      <Stack spacing={{ xs: 5, md: 8 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <DashboardInfoCard
              eyebrow="Marketing launcher"
              title="Create, fund, and launch social campaigns"
              description="Build a HUMAN Protocol marketing escrow from your wallet. The flow prepares the manifest, handles encryption when needed, approves the selected token, and launches the escrow directly."
              cta
              ctaDisabled={!isConnected}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardInfoCard
              eyebrow="Job types"
              title="Promotion or engagement"
              description="Create X promotions, X engagement checks, or LinkedIn engagement jobs with platform-specific validation."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardInfoCard
              eyebrow="Privacy"
              title="Encrypted manifests"
              description="X like checks encrypt the manifest with oracle public keys and your launcher public key from KVStore."
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <MarketingDescriptionCard
              label="1"
              title="Choose the job"
              description="Start with social media promotion or engagement. The next step narrows available platforms so LinkedIn only appears where it is supported."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MarketingDescriptionCard
              label="2"
              title="Define validation"
              description="Add campaign details, reward funding, dates, and the required promotion or engagement checks for the selected platform."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MarketingDescriptionCard
              label="3"
              title="Review and launch"
              description="Review the exact manifest string, confirm public key status, approve the selected token, and create the escrow from the connected wallet."
            />
          </Grid>
        </Grid>
      </Stack>
    </Shell>
  );
};

const CreateCampaignPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<CampaignFormState>(getDefaultForm);
  const [publicKeys, setPublicKeys] = useState<PublicKeysState>(keyStateIdle);
  const [preparedManifest, setPreparedManifest] =
    useState<PreparedManifest | null>(null);
  const [prepareError, setPrepareError] = useState<string>('');
  const [toast, setToast] = useState<{
    message: ReactNode;
    open: boolean;
    severity: AlertColor;
  }>({ message: '', open: false, severity: 'error' });

  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const escrow = useMarketingEscrow();

  const encryptionRequired = requiresEncryption(form);
  const selectedChain = supportedChains.find((chain) => chain.id === form.chainId);
  const isWrongNetwork = chainId !== form.chainId;
  const manifestPreview = useMemo(() => {
    if (!preparedManifest) return '';
    const value =
      preparedManifest.mode === 'plain'
        ? JSON.stringify(preparedManifest.manifest, null, 2)
        : preparedManifest.manifestString;

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
    value: CampaignFormState[K]
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
    value: CampaignFormState['promotion'][K]
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
    value: CampaignFormState['engagement'][K]
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
    value: CampaignFormState['engagement']['xApiCredentials'][K]
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
        ].includes(error)
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
      if (activeStep !== 4 || !address) return;

      setPreparedManifest(null);
      setPrepareError('');

      if (!encryptionRequired) {
        setPublicKeys(keyStateIdle);

        try {
          const prepared = await prepareManifest(form, keyStateIdle);
          if (!cancelled) setPreparedManifest(prepared);
        } catch (error) {
          if (!cancelled) {
            setPrepareError(
              error instanceof Error
                ? error.message
                : 'Failed to prepare manifest'
            );
          }
        }
        return;
      }

      setPublicKeys({ ...keyStateIdle, isLoading: true });

      const keys = await getPublicKeys(
        form.chainId,
        address as `0x${string}`,
        encryptionRequired
      );

      if (cancelled) return;

      setPublicKeys(keys);

      if (keys.error) {
        setPrepareError(keys.error);
        return;
      }

      try {
        const prepared = await prepareManifest(form, keys);
        if (!cancelled) setPreparedManifest(prepared);
      } catch (error) {
        if (!cancelled) {
          setPrepareError(
            error instanceof Error
              ? error.message
              : 'Failed to prepare manifest'
          );
        }
      }
    };

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [activeStep, address, encryptionRequired, form]);

  const handleLaunch = async () => {
    if (!preparedManifest) return;
    await escrow.launchEscrow({
      chainId: form.chainId,
      fundToken: form.fundToken,
      fundAmount: form.fundAmount,
      preparedManifest,
    });
  };

  useEffect(() => {
    if (!prepareError) return;

    const text = getPublicKeySetupErrorText(prepareError);
    setToast({
      open: true,
      severity: 'error',
      message:
        encryptionRequired && PUBLIC_KEY_SETUP_URL ? (
          <>
            {text}{' '}
            <Link
              href={PUBLIC_KEY_SETUP_URL}
              target="_blank"
              rel="noreferrer"
              sx={{ color: 'inherit', fontWeight: 800, textDecoration: 'underline' }}
            >
              Set public key
            </Link>
          </>
        ) : (
          text
        ),
    });
  }, [encryptionRequired, prepareError]);

  useEffect(() => {
    if (!escrow.error) return;

    setToast({
      open: true,
      severity: 'error',
      message: escrow.error.message,
    });
  }, [escrow.error]);

  useEffect(() => {
    if (!escrow.result) return;

    setToast({
      open: true,
      severity: 'success',
      message: `Escrow created: ${escrow.result.escrowAddress}`,
    });
  }, [escrow.result]);

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
            (form.requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION ? (
              <PromotionFields form={form} updatePromotion={updatePromotion} />
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
              publicKeys={publicKeys}
              preparedManifest={preparedManifest}
              isWrongNetwork={isWrongNetwork}
              isSwitchingChain={isSwitchingChain}
              selectedChainName={selectedChain?.name || ''}
              manifestPreview={manifestPreview}
              onSwitchChain={() => switchChain({ chainId: form.chainId })}
            />
          )}

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
            <Button
              variant="outlined"
              onClick={activeStep === 0 ? () => navigate('/') : goBack}
              disabled={escrow.isLoading}
            >
              {activeStep === 0 ? 'Home' : 'Back'}
            </Button>
            {activeStep < 4 && (
              <Button
                variant="contained"
                onClick={goNext}
              >
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
      </Stack>
    </Shell>
  );
};

type DashboardInfoCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  cta?: boolean;
  ctaDisabled?: boolean;
};

const DashboardInfoCard = ({
  eyebrow,
  title,
  description,
  cta,
  ctaDisabled,
}: DashboardInfoCardProps) => (
  <Paper
    elevation={0}
    sx={{
      height: '100%',
      p: { xs: 2.5, md: 3 },
      border: '1px solid #433679',
      bgcolor: '#251d47',
    }}
  >
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Typography
        sx={{
          color: '#7f78a8',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <Typography variant="h5" sx={{ color: 'white', mb: 1 }}>
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Box>
      {cta && (
        <Button
          component={ctaDisabled ? 'button' : RouterLink}
          to={ctaDisabled ? undefined : '/create'}
          disabled={ctaDisabled}
          variant="contained"
          sx={{
            width: 'fit-content',
            bgcolor: 'error.main',
            color: 'white',
            '&:hover': { bgcolor: '#d91967' },
          }}
        >
          Create campaign
        </Button>
      )}
    </Stack>
  </Paper>
);

type MarketingDescriptionCardProps = {
  label: string;
  title: string;
  description: string;
};

const MarketingDescriptionCard = ({
  label,
  title,
  description,
}: MarketingDescriptionCardProps) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2.5, md: 3 },
      bgcolor: '#251d47',
      border: '1px solid #433679',
      height: '100%',
    }}
  >
    <Stack gap={2}>
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: '#12073a',
          border: '1px solid #433679',
          borderRadius: '8px',
          color: '#ff2d7a',
          display: 'flex',
          fontWeight: 800,
          height: 40,
          justifyContent: 'center',
          width: 40,
        }}
      >
        {label}
      </Box>
      <Typography variant="h6" sx={{ color: 'white' }}>
        {title}
      </Typography>
      <Typography color="text.secondary">{description}</Typography>
    </Stack>
  </Paper>
);

type JobTypeStepProps = {
  form: CampaignFormState;
  onSelect: (requestType: CampaignRequestType) => void;
};

const JobTypeStep = ({ form, onSelect }: JobTypeStepProps) => (
  <Stack gap={3}>
    <Box>
      <Typography variant="h5">Choose job type</Typography>
      <Typography color="text.secondary">
        Start with the marketing workflow you want to validate.
      </Typography>
    </Box>
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SelectionCard
          selected={
            form.requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION
          }
          title="Social media promotion"
          description="Workers publish original content that matches hashtags, links, keywords, media and quality requirements."
          onClick={() =>
            onSelect(CampaignRequestType.SOCIAL_MEDIA_PROMOTION)
          }
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <SelectionCard
          selected={
            form.requestType === CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT
          }
          title="Social media engagement"
          description="Workers interact with a target post through likes, comments, reposts, or quotes."
          onClick={() =>
            onSelect(CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT)
          }
        />
      </Grid>
    </Grid>
  </Stack>
);

type PlatformStepProps = {
  form: CampaignFormState;
  onSelect: (platform: SocialPlatform) => void;
};

const PlatformStep = ({ form, onSelect }: PlatformStepProps) => {
  const isPromotion =
    form.requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION;

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5">Choose platform</Typography>
        <Typography color="text.secondary">
          LinkedIn is currently available only for engagement campaigns.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SelectionCard
            selected={form.platform === SocialPlatform.X}
            title="X / Twitter"
            description="Available for promotion and engagement campaigns."
            onClick={() => onSelect(SocialPlatform.X)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SelectionCard
            selected={form.platform === SocialPlatform.LINKEDIN}
            title="LinkedIn"
            description="Available for engagement campaigns with like and comment checks."
            disabled={isPromotion}
            onClick={() => onSelect(SocialPlatform.LINKEDIN)}
          />
        </Grid>
      </Grid>
      {isPromotion && (
        <Alert severity="info">
          Social media promotion is limited to X / Twitter for this version.
        </Alert>
      )}
    </Stack>
  );
};

type GeneralDataStepProps = {
  form: CampaignFormState;
  updateForm: <K extends keyof CampaignFormState>(
    key: K,
    value: CampaignFormState[K]
  ) => void;
  onChainChange: (chainId: CampaignFormState['chainId']) => void;
};

const GeneralDataStep = ({
  form,
  updateForm,
  onChainChange,
}: GeneralDataStepProps) => {
  const fundingTokenOptions = getFundingTokenOptions(form.chainId);

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5">General campaign data</Typography>
        <Typography color="text.secondary">
          These fields are shared by every marketing manifest.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Field
            select
            label="Network"
            value={form.chainId}
            onChange={(event) =>
              onChainChange(
                Number(event.target.value) as CampaignFormState['chainId']
              )
            }
          >
            {supportedChains.map((chain) => (
              <MenuItem key={chain.id} value={chain.id}>
                {chain.name}
              </MenuItem>
            ))}
          </Field>
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            select
            label="Currency"
            value={form.fundToken}
            onChange={(event) =>
              updateForm('fundToken', event.target.value as EscrowFundToken)
            }
          >
            {fundingTokenOptions.map((token) => (
              <MenuItem key={token.symbol} value={token.symbol}>
                {token.symbol}
              </MenuItem>
            ))}
          </Field>
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            label="Fund amount"
            type="number"
            value={form.fundAmount}
            onChange={(event) => updateForm('fundAmount', event.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            label="Campaign name"
            value={form.campaignName}
            onChange={(event) => updateForm('campaignName', event.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            label="Submissions required"
            type="number"
            value={form.submissionsRequired}
            onChange={(event) =>
              updateForm('submissionsRequired', event.target.value)
            }
          />
        </Grid>
        <Grid item xs={12}>
          <Field
            label="Campaign description"
            multiline
            minRows={3}
            value={form.campaignDescription}
            onChange={(event) =>
              updateForm('campaignDescription', event.target.value)
            }
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            label="End date"
            type="datetime-local"
            value={form.endDate}
            onChange={(event) => updateForm('endDate', event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Field
            label="Qualifications"
            placeholder="comma,separated,refs"
            value={form.qualifications}
            onChange={(event) => updateForm('qualifications', event.target.value)}
          />
        </Grid>
      </Grid>
    </Stack>
  );
};

type SelectionCardProps = {
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
};

const SelectionCard = ({
  selected,
  title,
  description,
  disabled,
  onClick,
}: SelectionCardProps) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderColor: selected ? 'primary.main' : 'divider',
      bgcolor: disabled ? '#211a3f' : '#251d47',
      opacity: disabled ? 0.55 : 1,
    }}
  >
    <CardActionArea
      disabled={disabled}
      onClick={onClick}
      sx={{ height: '100%', p: 2, alignItems: 'stretch' }}
    >
      <Stack gap={1}>
        <Typography variant="h6" sx={{ color: 'white' }}>
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Stack>
    </CardActionArea>
  </Card>
);

type PromotionFieldsProps = {
  form: CampaignFormState;
  updatePromotion: <K extends keyof CampaignFormState['promotion']>(
    key: K,
    value: CampaignFormState['promotion'][K]
  ) => void;
};

const PromotionFields = ({ form, updatePromotion }: PromotionFieldsProps) => (
  <Stack gap={3}>
    <Box>
      <Typography variant="h5">Promotion details</Typography>
      <Typography color="text.secondary">
        Define what a valid social media post must contain.
      </Typography>
    </Box>
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Field
          label="Required hashtags"
          placeholder="#humanprotocol,#marketing"
          value={form.promotion.requiredHashtags}
          onChange={(event) =>
            updatePromotion('requiredHashtags', event.target.value)
          }
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Field
          label="Required keywords"
          placeholder="marketing campaign,recording oracle"
          value={form.promotion.requiredKeywords}
          onChange={(event) =>
            updatePromotion('requiredKeywords', event.target.value)
          }
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Field
          label="Required link"
          value={form.promotion.requiredLink}
          onChange={(event) => updatePromotion('requiredLink', event.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Field
          label="Minimum length"
          type="number"
          value={form.promotion.minLength}
          onChange={(event) => updatePromotion('minLength', event.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          label="Min live duration hours"
          type="number"
          value={form.promotion.minLiveDurationHours}
          onChange={(event) =>
            updatePromotion('minLiveDurationHours', event.target.value)
          }
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          label="Minimum followers"
          type="number"
          value={form.promotion.minFollowers}
          onChange={(event) => updatePromotion('minFollowers', event.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          label="Minimum account age days"
          type="number"
          value={form.promotion.minAccountAgeDays}
          onChange={(event) =>
            updatePromotion('minAccountAgeDays', event.target.value)
          }
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          label="Minimum likes"
          type="number"
          value={form.promotion.minLikes}
          onChange={(event) => updatePromotion('minLikes', event.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          label="Minimum reposts"
          type="number"
          value={form.promotion.minReposts}
          onChange={(event) => updatePromotion('minReposts', event.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Field
          select
          label="Allowed abuse probability"
          value={form.promotion.allowedAbuseProbability}
          onChange={(event) =>
            updatePromotion(
              'allowedAbuseProbability',
              event.target.value as CampaignFormState['promotion']['allowedAbuseProbability']
            )
          }
        >
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
        </Field>
      </Grid>
      <Grid item xs={12}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.promotion.mustBePublic}
                onChange={(event) =>
                  updatePromotion('mustBePublic', event.target.checked)
                }
              />
            }
            label="Must be public"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.promotion.requiresMedia}
                onChange={(event) =>
                  updatePromotion('requiresMedia', event.target.checked)
                }
              />
            }
            label="Requires media"
          />
        </Stack>
      </Grid>
    </Grid>
  </Stack>
);

type EngagementFieldsProps = {
  form: CampaignFormState;
  updateEngagement: <K extends keyof CampaignFormState['engagement']>(
    key: K,
    value: CampaignFormState['engagement'][K]
  ) => void;
  updateXCredentials: <
    K extends keyof CampaignFormState['engagement']['xApiCredentials'],
  >(
    key: K,
    value: CampaignFormState['engagement']['xApiCredentials'][K]
  ) => void;
};

const EngagementFields = ({
  form,
  updateEngagement,
  updateXCredentials,
}: EngagementFieldsProps) => {
  const isLinkedIn = form.platform === SocialPlatform.LINKEDIN;
  const xLikeRequiresEncryption =
    form.platform === SocialPlatform.X && form.engagement.checkLike;

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5">Engagement details</Typography>
        <Typography color="text.secondary">
          Define what interactions workers must perform on the target post.
        </Typography>
      </Box>
      <Field
        label="Target post URL"
        value={form.engagement.targetPostUrl}
        onChange={(event) =>
          updateEngagement('targetPostUrl', event.target.value)
        }
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.engagement.checkLike}
              onChange={(event) =>
                updateEngagement('checkLike', event.target.checked)
              }
            />
          }
          label="Check like"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.engagement.checkComment}
              onChange={(event) =>
                updateEngagement('checkComment', event.target.checked)
              }
            />
          }
          label="Check comment"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.engagement.checkRepost}
              disabled={isLinkedIn}
              onChange={(event) =>
                updateEngagement('checkRepost', event.target.checked)
              }
            />
          }
          label="Check repost"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.engagement.checkQuote}
              disabled={isLinkedIn}
              onChange={(event) =>
                updateEngagement('checkQuote', event.target.checked)
              }
            />
          }
          label="Check quote"
        />
      </Stack>

      {isLinkedIn && (
        <Alert severity="info">LinkedIn supports like and comment checks only.</Alert>
      )}

      {xLikeRequiresEncryption && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            X API credentials
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These fields are included only in the encrypted manifest.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Field
                label="Consumer key"
                value={form.engagement.xApiCredentials.consumerKey}
                onChange={(event) =>
                  updateXCredentials('consumerKey', event.target.value)
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Field
                label="Consumer secret"
                type="password"
                value={form.engagement.xApiCredentials.consumerSecret}
                onChange={(event) =>
                  updateXCredentials('consumerSecret', event.target.value)
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Field
                label="Access token"
                value={form.engagement.xApiCredentials.accessToken}
                onChange={(event) =>
                  updateXCredentials('accessToken', event.target.value)
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Field
                label="Access token secret"
                type="password"
                value={form.engagement.xApiCredentials.accessTokenSecret}
                onChange={(event) =>
                  updateXCredentials('accessTokenSecret', event.target.value)
                }
              />
            </Grid>
          </Grid>
        </Paper>
      )}
    </Stack>
  );
};

type SummaryStepProps = {
  form: CampaignFormState;
  encryptionRequired: boolean;
  publicKeys: PublicKeysState;
  preparedManifest: PreparedManifest | null;
  isWrongNetwork: boolean;
  isSwitchingChain: boolean;
  selectedChainName: string;
  manifestPreview: string;
  onSwitchChain: () => void;
};

const SummaryStep = ({
  form,
  encryptionRequired,
  publicKeys,
  preparedManifest,
  isWrongNetwork,
  isSwitchingChain,
  selectedChainName,
  manifestPreview,
  onSwitchChain,
}: SummaryStepProps) => (
  <Stack gap={3}>
    <Box>
      <Typography variant="h5">Review and launch</Typography>
      <Typography color="text.secondary">
        Confirm the exact manifest string and escrow settings before approving
        the selected token.
      </Typography>
    </Box>

    {isWrongNetwork && (
      <Alert
        severity="warning"
        action={
          <Button
            color="inherit"
            size="small"
            disabled={isSwitchingChain}
            onClick={onSwitchChain}
          >
            Switch
          </Button>
        }
      >
        Switch your wallet to {selectedChainName} before launching.
      </Alert>
    )}
    {encryptionRequired && publicKeys.isLoading && (
      <Alert severity="info">Fetching KVStore public keys...</Alert>
    )}
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SummaryPanel
          form={form}
          encryptionRequired={encryptionRequired}
          preparedManifest={preparedManifest}
          publicKeys={publicKeys}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: '#211a3f',
            borderColor: '#433679',
            minHeight: 360,
            maxHeight: 520,
            overflow: 'auto',
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
            Manifest preview
          </Typography>
          <Box
            component="pre"
            sx={{
              color: '#d7cffd',
              m: 0,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {manifestPreview || 'Manifest is not ready yet.'}
          </Box>
        </Paper>
      </Grid>
    </Grid>

    <Alert severity="info">
      The launcher will approve {form.fundToken} if allowance is insufficient,
      then create the escrow with the prepared manifest.
    </Alert>

  </Stack>
);

type SummaryPanelProps = {
  form: CampaignFormState;
  encryptionRequired: boolean;
  preparedManifest: PreparedManifest | null;
  publicKeys: PublicKeysState;
};

const SummaryPanel = ({
  form,
  encryptionRequired,
  preparedManifest,
  publicKeys,
}: SummaryPanelProps) => {
  const selectedChain = supportedChains.find((chain) => chain.id === form.chainId);
  const selectedToken = getFundingTokenConfig(form.chainId, form.fundToken);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, bgcolor: '#211a3f', borderColor: '#433679' }}
    >
      <Stack gap={2}>
        <Typography variant="h6" sx={{ color: 'white' }}>
          Launch summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Network" value={selectedChain?.name || ''} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue
              label="Fund amount"
              value={`${form.fundAmount} ${form.fundToken}`}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Currency" value={form.fundToken} />
          </Grid>
          <Grid item xs={12}>
            <KeyValue label="Token address" value={selectedToken?.address || '-'} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Campaign type" value={form.requestType} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Platform" value={form.platform} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Manifest mode" value={preparedManifest?.mode || '-'} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue
              label="Encryption required"
              value={encryptionRequired ? 'Yes' : 'No'}
            />
          </Grid>
          {encryptionRequired && (
            <>
              <Grid item xs={12}>
                <KeyValue
                  label="User public key"
                  value={shortKeyPreview(publicKeys.userPublicKey)}
                />
              </Grid>
              <Grid item xs={12}>
                <KeyValue
                  label="Oracle public keys"
                  value={`${publicKeys.oraclePublicKeys.length} loaded`}
                />
              </Grid>
            </>
          )}
          <Grid item xs={12}>
            <KeyValue
              label="Manifest hash"
              value={preparedManifest?.manifestHash || '-'}
            />
          </Grid>
        </Grid>
        {encryptionRequired && (
          <>
            <Divider />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <KeyValue
                  label="Exchange oracle"
                  value={ORACLE_ADDRESSES.exchangeOracle}
                />
              </Grid>
              <Grid item xs={12}>
                <KeyValue
                  label="Recording oracle"
                  value={ORACLE_ADDRESSES.recordingOracle}
                />
              </Grid>
              <Grid item xs={12}>
                <KeyValue
                  label="Reputation oracle"
                  value={ORACLE_ADDRESSES.reputationOracle}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default App;
