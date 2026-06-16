import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#b9a6ff',
      dark: '#2a214a',
    },
    secondary: {
      main: '#ff2d7a',
    },
    background: {
      default: '#0c032c',
      paper: '#251d47',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a29dca',
    },
    error: {
      main: '#ff2d7a',
    },
    warning: {
      main: '#b56600',
    },
    success: {
      main: '#0e976e',
    },
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h4: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h5: {
      fontSize: '22px',
      fontWeight: 700,
    },
    h6: {
      fontSize: '17px',
      fontWeight: 700,
    },
    body1: {
      fontSize: '15px',
      lineHeight: '24px',
    },
    body2: {
      fontSize: '14px',
      lineHeight: '22px',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 700,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          background: '#251d47',
          border: '1px solid #433679',
          boxShadow:
            '0px 1px 4px rgba(0, 0, 0, 0.12), 0px 8px 24px rgba(0, 0, 0, 0.10)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          color: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#433679',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6b5bb2',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#b9a6ff',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#a29dca',
          '&.Mui-focused': {
            color: '#b9a6ff',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#b9a6ff',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: '#251d47',
          color: '#ffffff',
        },
      },
    },
  },
});

export default theme;
