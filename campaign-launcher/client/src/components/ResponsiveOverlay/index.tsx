import { type FC, type PropsWithChildren } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  Drawer,
  IconButton,
  Paper,
  type SxProps,
  type Theme,
} from '@mui/material';

import { useIsMobile } from '@/hooks/useBreakpoints';

type Props = {
  open: boolean;
  onClose: () => void;
  desktopSx?: SxProps<Theme>;
  mobileSx?: SxProps<Theme>;
  closeButtonSx?: SxProps<Theme>;
};

const closeButtonBaseSx = {
  position: 'absolute',
  color: 'text.secondary',
  zIndex: 2,
};

const ResponsiveOverlay: FC<PropsWithChildren<Props>> = ({
  open,
  onClose,
  desktopSx,
  mobileSx,
  closeButtonSx,
  children,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            border: '1px solid #433679',
            ...mobileSx,
          },
        }}
      >
        <IconButton
          aria-label="Close wallet modal"
          onClick={onClose}
          sx={{ ...closeButtonBaseSx, ...closeButtonSx }}
        >
          <CloseIcon />
        </IconButton>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperComponent={Paper}
      PaperProps={{
        sx: {
          position: 'relative',
          bgcolor: 'background.paper',
          border: '1px solid #433679',
          overflow: 'hidden',
          ...desktopSx,
        },
      }}
    >
      <IconButton
        aria-label="Close wallet modal"
        onClick={onClose}
        sx={{ ...closeButtonBaseSx, ...closeButtonSx }}
      >
        <CloseIcon />
      </IconButton>
      {children}
    </Dialog>
  );
};

export default ResponsiveOverlay;
