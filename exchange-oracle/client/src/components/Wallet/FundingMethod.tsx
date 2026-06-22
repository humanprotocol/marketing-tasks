import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import fundCryptoImg from '../../assets/fund-crypto.png';
import WalletModal from './WalletModal';
import SolutionForm from '../SolutionForm';

export const FundingMethod = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { isConnected } = useAccount();

  const handleClickCrypto = () => {
    if (!isConnected) {
      setWalletModalOpen(true);
    }
  };

  useEffect(() => {
    if (isConnected && walletModalOpen) {
      setWalletModalOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return (
    <>
      {isConnected ? (
        <SolutionForm />
      ) : (
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
          <Stack alignItems="center" spacing={3} sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                width: 112,
                height: 112,
                borderRadius: '8px',
                background: '#211947',
                border: '1px solid #3f3569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={fundCryptoImg}
                alt="crypto"
                style={{ width: 78, height: 'auto' }}
              />
            </Box>
            <Box>
              <Typography variant="h4" color="text.primary">
                Connect Your Wallet
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: 420 }}
              >
                Use the worker wallet assigned to this task before submitting
                your solution.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              sx={{ minWidth: '200px' }}
              onClick={handleClickCrypto}
            >
              Connect wallet
            </Button>
          </Stack>
        </Box>
      )}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
};
