import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import { Field } from '@/components/Field';
import { KeyValue } from '@/components/KeyValue';
import { ORACLE_ADDRESSES } from '@/constants';
import {
  getFundingTokenConfig,
  getFundingTokenOptions,
} from '@/constants/fundingTokens';
import { supportedChains } from '@/providers/wagmiConfig';
import {
  CampaignRequestType,
  EscrowFundToken,
  SocialPlatform,
  type CampaignFormState,
  type PreparedManifest,
  type RecordingOracleKeyState,
} from '@/types';
import { shortKeyPreview } from '@/utils/manifest';

type JobTypeStepProps = {
  form: CampaignFormState;
  onSelect: (requestType: CampaignRequestType) => void;
};

export const JobTypeStep = ({ form, onSelect }: JobTypeStepProps) => (
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
          onClick={() => onSelect(CampaignRequestType.SOCIAL_MEDIA_PROMOTION)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <SelectionCard
          selected={
            form.requestType === CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT
          }
          title="Social media engagement"
          description="Workers interact with a target post through likes, comments, reposts, or quotes."
          onClick={() => onSelect(CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT)}
        />
      </Grid>
    </Grid>
  </Stack>
);

type PlatformStepProps = {
  form: CampaignFormState;
  onSelect: (platform: SocialPlatform) => void;
};

export const PlatformStep = ({ form, onSelect }: PlatformStepProps) => {
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
    value: CampaignFormState[K],
  ) => void;
  onChainChange: (chainId: CampaignFormState['chainId']) => void;
};

export const GeneralDataStep = ({
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
                Number(event.target.value) as CampaignFormState['chainId'],
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
            onChange={(event) =>
              updateForm('qualifications', event.target.value)
            }
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
    value: CampaignFormState['promotion'][K],
  ) => void;
};

export const PromotionFields = ({
  form,
  updatePromotion,
}: PromotionFieldsProps) => (
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
          onChange={(event) =>
            updatePromotion('requiredLink', event.target.value)
          }
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
          onChange={(event) =>
            updatePromotion('minFollowers', event.target.value)
          }
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
          onChange={(event) =>
            updatePromotion('minReposts', event.target.value)
          }
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
              event.target
                .value as CampaignFormState['promotion']['allowedAbuseProbability'],
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
    value: CampaignFormState['engagement'][K],
  ) => void;
  updateXCredentials: <
    K extends keyof CampaignFormState['engagement']['xApiCredentials'],
  >(
    key: K,
    value: CampaignFormState['engagement']['xApiCredentials'][K],
  ) => void;
};

export const EngagementFields = ({
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
        <Alert severity="info">
          LinkedIn supports like and comment checks only.
        </Alert>
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
  recordingOracleKey: RecordingOracleKeyState;
  preparedManifest: PreparedManifest | null;
  isWrongNetwork: boolean;
  isSwitchingChain: boolean;
  selectedChainName: string;
  manifestPreview: string;
  onSwitchChain: () => void;
};

export const SummaryStep = ({
  form,
  encryptionRequired,
  recordingOracleKey,
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
    {encryptionRequired && recordingOracleKey.isLoading && (
      <Alert severity="info">Fetching recording oracle public key...</Alert>
    )}
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <SummaryPanel
          form={form}
          encryptionRequired={encryptionRequired}
          preparedManifest={preparedManifest}
          recordingOracleKey={recordingOracleKey}
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
  recordingOracleKey: RecordingOracleKeyState;
};

const SummaryPanel = ({
  form,
  encryptionRequired,
  preparedManifest,
  recordingOracleKey,
}: SummaryPanelProps) => {
  const selectedChain = supportedChains.find(
    (chain) => chain.id === form.chainId,
  );
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
            <KeyValue
              label="Token address"
              value={selectedToken?.address || '-'}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Campaign type" value={form.requestType} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue label="Platform" value={form.platform} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue
              label="Manifest mode"
              value={preparedManifest?.mode || '-'}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KeyValue
              label="Credentials encryption"
              value={encryptionRequired ? 'Yes' : 'No'}
            />
          </Grid>
          {encryptionRequired && (
            <Grid item xs={12}>
              <KeyValue
                label="Recording oracle public key"
                value={shortKeyPreview(recordingOracleKey.publicKey)}
              />
            </Grid>
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
                  label="Recording oracle"
                  value={ORACLE_ADDRESSES.recordingOracle}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Paper>
  );
};
