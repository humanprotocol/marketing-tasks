import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff1f7a',
      light: '#ff5aa1',
      dark: '#d81064',
    },
    info: {
      main: '#8d83c7',
      light: '#c9c2ff',
      dark: '#5e538f',
    },
    secondary: {
      main: '#c7bdff',
      light: '#eee9ff',
      dark: '#7d70b8',
      contrastText: '#100735',
    },
    text: {
      primary: '#ffffff',
      secondary: '#9b91d4',
    },
    background: {
      default: '#0d0433',
      paper: '#271f4f',
    },
    success: {
      main: '#23b889',
    },
    warning: {
      main: '#f5b800',
    },
    error: {
      main: '#ff3b80',
    },
  },
  typography: {
    fontFamily: 'Inter',
    h2: {
      fontSize: '80px',
      lineHeight: 1.5,
      letterSpacing: 0,
      fontWeight: 800,
    },
    h4: {
      fontSize: '28px',
      fontWeight: 800,
      letterSpacing: 0,
    },
    h6: {
      fontSize: '20px',
      lineHeight: '160%',
    },
    body1: {
      fontSize: '16px',
      lineHeight: '28px',
    },
    body2: {
      fontSize: '14px',
      lineHeight: '24px',
    },
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        standardWarning: {
          color: '#ffffff',
          backgroundColor: '#33275f',
          border: '1px solid #4f4380',
        },
        standardError: {
          color: '#ffffff',
          backgroundColor: '#3c1942',
          border: '1px solid #7e2d63',
        },
        standardSuccess: {
          color: '#ffffff',
          backgroundColor: '#173f3d',
          border: '1px solid #246c62',
        },
        outlinedSuccess: {
          color: '#ffffff',
          borderColor: '#23b889',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '6px',
          boxShadow: 'none',
          fontWeight: 800,
        },
        contained: {
          color: '#ffffff',
          backgroundColor: '#ff1f7a',
          '&:hover': {
            backgroundColor: '#e9166b',
            boxShadow: '0 8px 18px rgba(255, 31, 122, 0.20)',
          },
        },
        outlined: {
          color: '#ffffff',
          borderColor: '#4c3d82',
          '&:hover': {
            borderColor: '#ff1f7a',
            backgroundColor: 'rgba(255, 31, 122, 0.08)',
          },
        },
        sizeLarge: {
          fontSize: '15px',
          fontWeight: '600',
          lineHeight: '24px',
          padding: '12px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          background: '#271f4f',
          border: '1px solid #3f3569',
          boxShadow: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '32px 20px 18px !important',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: 'none',
          color: '#c7bdff',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          backgroundColor: '#201844',
          borderRadius: '8px',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: '1px',
            borderColor: '#ff1f7a',
          },
        },
        notchedOutline: {
          borderColor: '#514681',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9b91d4',
          '&.Mui-focused': {
            color: '#ff5aa1',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: '#9b91d4',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: '28px',
          borderRadius: '999px',
          color: '#ffffff',
          backgroundColor: '#342a60',
          border: '1px solid #4a3f78',
          fontWeight: 700,
        },
        colorPrimary: {
          color: '#180a3d',
          backgroundColor: '#c7bdff',
          borderColor: '#c7bdff',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#3f3569',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: '#271f4f',
          border: '1px solid #3f3569',
          borderRadius: '8px',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#c7bdff',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          border: '1px solid #4c3d82',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '14px',
          '&.Mui-selected': {
            background: '#ff1f7a',
            color: '#fff',
          },
          '&.Mui-selected:hover': {
            background: '#ff1f7a',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: '#33275f',
          },
        },
      },
    },
  },
});

export default theme;
