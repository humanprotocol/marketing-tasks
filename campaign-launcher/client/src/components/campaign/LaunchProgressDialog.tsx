import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';

type LaunchProgressDialogProps = {
  open: boolean;
  isApproving: boolean;
  isCreating: boolean;
  isNotifyingExchange: boolean;
  error?: Error;
  escrowAddress?: string;
  onClose: () => void;
};

const getLaunchProgressStep = ({
  isApproving,
  isCreating,
  isNotifyingExchange,
  escrowAddress,
}: Pick<
  LaunchProgressDialogProps,
  'isApproving' | 'isCreating' | 'isNotifyingExchange' | 'escrowAddress'
>): number => {
  if (escrowAddress) return 3;
  if (isNotifyingExchange) return 2;
  if (isCreating) return 1;
  if (isApproving) return 0;
  return 0;
};

const LaunchProgressDialog = ({
  open,
  isApproving,
  isCreating,
  isNotifyingExchange,
  error,
  escrowAddress,
  onClose,
}: LaunchProgressDialogProps) => {
  const activeStep = getLaunchProgressStep({
    isApproving,
    isCreating,
    isNotifyingExchange,
    escrowAddress,
  });
  const canClose = Boolean(escrowAddress) || Boolean(error);
  const launchSteps = [
    {
      label: 'Approve funds',
      description: isApproving
        ? 'Waiting for token approval confirmation.'
        : 'Token approval confirmed.',
    },
    {
      label: 'Create escrow',
      description: isCreating
        ? 'Waiting for escrow creation confirmation.'
        : 'Escrow creation transaction confirmed.',
    },
    {
      label: 'Sign webhook',
      description: isNotifyingExchange
        ? 'Waiting for webhook signature and exchange oracle notification.'
        : 'Exchange oracle webhook acknowledged.',
    },
    {
      label: 'Escrow completed',
      description: escrowAddress
        ? `Escrow created: ${escrowAddress}`
        : 'Escrow creation is not completed yet.',
    },
  ];

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Launch campaign</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error.message}</Alert>}
          <Stepper activeStep={activeStep} orientation="vertical">
            {launchSteps.map((step) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!canClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LaunchProgressDialog;
