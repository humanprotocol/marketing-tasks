import useMediaQuery from '@mui/material/useMediaQuery';

export const useIsMobile = () => {
  const isSmall = useMediaQuery('(max-width: 900px)');
  return isSmall;
};
