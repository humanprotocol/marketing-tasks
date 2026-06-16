import { TextField, type TextFieldProps } from '@mui/material';

export const Field = (props: TextFieldProps) => {
  return <TextField fullWidth size="small" {...props} />;
};
