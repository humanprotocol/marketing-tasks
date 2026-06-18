import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  Grid,
  IconButton,
  Modal,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useMemo, useState } from "react";
import {
  useConnect,
  useConnectors,
  useDisconnect,
  type Connector,
} from "wagmi";
import coinbaseSvg from "../../assets/coinbase.svg";
import metaMaskSvg from "../../assets/metamask.svg";
import walletConnectSvg from "../../assets/walletconnect.svg";

const WALLET_ICONS: Record<string, string> = {
  metaMask: metaMaskSvg,
  injected: metaMaskSvg,
  coinbaseWalletSDK: coinbaseSvg,
  coinbaseWallet: coinbaseSvg,
  walletConnect: walletConnectSvg,
};

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connectAsync } = useConnect();
  const connectors = useConnectors();
  const { disconnectAsync } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [connectingConnectorId, setConnectingConnectorId] = useState<
    string | null
  >(null);
  const isMobile = useMediaQuery("(max-width: 900px)");

  const displayedConnectors = useMemo(
    () => (showAllWallets ? connectors : connectors.slice(0, 6)),
    [connectors, showAllWallets]
  );

  const hasMoreWallets = connectors.length > displayedConnectors.length;

  const handleConnect = async (connector: Connector) => {
    setError(null);
    setConnectingConnectorId(connector.id);

    try {
      if (connector.id === "walletConnect") {
        onClose();
      }

      await connectAsync({ connector });
      onClose();
    } catch (e) {
      const err = e as { message?: string };

      if (err.message?.includes("Connector already connected")) {
        await disconnectAsync();
        await handleConnect(connector);
        return;
      }

      setError(err.message ?? "Unable to connect wallet");
    } finally {
      setConnectingConnectorId(null);
    }
  };

  const content = (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Typography variant="h6" sx={{ color: "white", mb: 1 }}>
        Connect Wallet
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.primary", fontWeight: 500, mb: 3, pr: 5 }}
      >
        Connect your wallet to continue and submit your solution.
      </Typography>
      <Box
        sx={{
          minHeight: 0,
          height: "100%",
          overflowY: "auto",
          pr: 0.5,
          pb: 2,
        }}
      >
        <Grid container spacing={2}>
          {displayedConnectors.map((connector) => {
            const isConnectingWallet = connectingConnectorId === connector.id;

            return (
              <Grid item xs={6} md={4} key={connector.id}>
                <Button
                  disabled={!!connectingConnectorId}
                  onClick={() => {
                    void handleConnect(connector);
                  }}
                  sx={{
                    alignItems: "center",
                    border: "1px solid",
                    borderColor: "rgba(205, 199, 255, 0.22)",
                    borderRadius: "8px",
                    color: "white",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    height: 132,
                    justifyContent: "center",
                    p: 2,
                    width: "100%",
                    "&:hover": {
                      bgcolor: "rgba(205, 199, 255, 0.08)",
                      borderColor: "rgba(205, 199, 255, 0.45)",
                    },
                  }}
                >
                  {isConnectingWallet ? (
                    <CircularProgress size={36} />
                  ) : (
                    <Box
                      component="img"
                      src={connector.icon ?? WALLET_ICONS[connector.id]}
                      alt={connector.name}
                      sx={{
                        borderRadius: 1.5,
                        height: 48,
                        objectFit: "contain",
                        width: 48,
                      }}
                    />
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      color: "white",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {connector.name}
                  </Typography>
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </Box>
      {error && (
        <Typography color="error.main" fontSize={12} mt={1.5}>
          {error}
        </Typography>
      )}
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          gap: 1,
          justifyContent: "center",
          mt: "auto",
          mx: { xs: -2, md: -4 },
          pt: 2,
          px: 2,
          borderTop: "1px solid #433679",
        }}
      >
        {!showAllWallets ? (
          <Button
            size="large"
            variant="outlined"
            startIcon={<SearchIcon />}
            disabled={!hasMoreWallets || !!connectingConnectorId}
            onClick={() => setShowAllWallets(true)}
          >
            Search Wallet
          </Button>
        ) : (
          <>
            <Button
              size="large"
              variant="outlined"
              fullWidth={isMobile}
              disabled={!!connectingConnectorId}
              onClick={() => setShowAllWallets(false)}
            >
              Back
            </Button>
            <Button
              size="large"
              variant="outlined"
              fullWidth={isMobile}
              disabled={!hasMoreWallets || !!connectingConnectorId}
              onClick={() => setShowAllWallets(true)}
            >
              Show more
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );

  const closeButton = (
    <IconButton
      onClick={onClose}
      sx={{
        p: 0,
        color: "white",
        position: "absolute",
        top: { xs: 16, md: 32 },
        right: { xs: 16, md: 32 },
        "&:hover": {
          bgcolor: "unset",
        },
      }}
    >
      <CloseIcon />
    </IconButton>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            bgcolor: "#251d47",
            borderRadius: "20px 20px 0 0",
            minHeight: "450px",
            maxHeight: "550px",
            overflowY: "hidden",
            p: 2,
            position: "relative",
          },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(7px)",
              background: "rgba(0, 0, 0, 0.3)",
            },
          },
        }}
      >
        {closeButton}
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mx: 0,
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(7px)",
            background: "rgba(0, 0, 0, 0.3)",
          },
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: 640,
          height: 600,
          maxHeight: "calc(100dvh - 48px)",
          overflowY: "hidden",
          bgcolor: "#251d47",
          borderRadius: "20px",
          position: "relative",
          boxShadow: "none",
          px: 4,
          py: 4,
        }}
      >
        {closeButton}
        {content}
      </Paper>
    </Modal>
  );
}
