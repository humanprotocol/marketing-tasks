import type { FC, PropsWithChildren } from 'react';

import { QueryClient, QueryClientProvider as TQueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const QueryClientProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <TQueryClientProvider client={queryClient}>{children}</TQueryClientProvider>
  );
};
