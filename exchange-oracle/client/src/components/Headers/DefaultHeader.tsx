import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AppBar, Box, Link as MuiLink, Toolbar } from '@mui/material';
import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../../assets/logo.svg';

export function DefaultHeader() {
  return (
    <AppBar
      component="nav"
      sx={{
        background: '#0d0433',
        borderBottom: '1px solid #33275f',
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ minHeight: '78px', px: { xs: 3, md: 10 } }}>
        <Link to="/" aria-label="Marketing Exchange Oracle">
          <img
            src={logoImg}
            alt="Marketing Exchange Oracle"
            style={{ display: 'block', width: 192 }}
          />
        </Link>
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 1.5,
            ml: 'auto',
          }}
        >
          <MuiLink
            component={Link}
            to="/"
            sx={{
              px: 2,
              py: 1,
              borderRadius: '8px',
              color: '#ffffff',
              background: '#211947',
              fontSize: '14px',
              fontWeight: 800,
            }}
          >
            Assignment
          </MuiLink>
          <MuiLink
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 1,
              color: '#8d83c7',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': { color: '#ffffff' },
            }}
            href="https://dashboard.humanprotocol.org"
          >
            Dashboard
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </MuiLink>
          <MuiLink
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 1,
              color: '#8d83c7',
              fontSize: '14px',
              fontWeight: 600,
              '&:hover': { color: '#ffffff' },
            }}
            href="https://humanprotocol.org"
          >
            HUMAN Website
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </MuiLink>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
