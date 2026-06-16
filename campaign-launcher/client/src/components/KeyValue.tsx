import { Box, Typography } from '@mui/material';

type Props = {
  label: string;
  value: string;
};

export const KeyValue = ({ label, value }: Props) => {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'white', overflowWrap: 'anywhere', fontWeight: 700 }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
};
