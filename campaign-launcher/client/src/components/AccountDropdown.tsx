import { useState, type FC } from 'react';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  Button,
  List,
  ListItemButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useAccount, useDisconnect } from 'wagmi';

const formatAddress = (address?: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const AccountDropdown: FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const open = Boolean(anchorEl);

  const closePopover = () => setAnchorEl(null);

  const handleDisconnect = () => {
    closePopover();
    disconnect();
  };

  return (
    <>
      <Button
        aria-describedby="account-popover"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          bgcolor: '#b9a6ff',
          borderRadius: '4px',
          color: '#1b0b50',
          px: 1.25,
          width: 'fit-content',
          '&:hover': { bgcolor: '#a58fff' },
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <AccountCircleIcon sx={{ width: 24, height: 24 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {formatAddress(address)}
          </Typography>
          <KeyboardArrowDownIcon
            sx={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out',
            }}
          />
        </Stack>
      </Button>
      <Popover
        id="account-popover"
        open={open}
        onClose={closePopover}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              bgcolor: '#b9a6ff',
              border: 'none',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              color: '#1b0b50',
              minWidth: anchorEl?.getBoundingClientRect().width,
            },
          },
        }}
      >
        <List sx={{ p: 0 }}>
          <ListItemButton
            onClick={handleDisconnect}
            sx={{
              gap: 1,
              fontWeight: 700,
              '&:hover': { bgcolor: '#a58fff' },
            }}
          >
            <LogoutIcon />
            Sign out
          </ListItemButton>
        </List>
      </Popover>
    </>
  );
};

export default AccountDropdown;
