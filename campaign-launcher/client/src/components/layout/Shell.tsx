import { AppBar, Box, Button, Container, Stack, Toolbar } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';

import AccountDropdown from '@/components/AccountDropdown';
import ConnectWallet from '@/components/ConnectWallet';

import Footer from '../Footer';

const docsUrl =
  import.meta.env.VITE_APP_DOCS_URL || 'https://docs.humanprotocol.org';
const stakeUrl =
  import.meta.env.VITE_APP_STAKING_DASHBOARD_URL ||
  'https://dashboard.humanprotocol.org';

type NavLinkProps = {
  to: string;
  active?: boolean;
  external?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

const NavLink = ({
  to,
  active,
  external,
  disabled,
  children,
}: NavLinkProps) => (
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

type ShellProps = {
  children: ReactNode;
};

const Shell = ({ children }: ShellProps) => {
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

export default Shell;
