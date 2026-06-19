import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAccount } from 'wagmi';

import Shell from '@/components/layout/Shell';

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
              title="Encrypted X credentials"
              description="X like checks keep the manifest as JSON and encrypt only API credentials with the recording oracle public key."
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

export default HomePage;
