import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  IconButton,
  Modal,
  Paper,
  Typography,
} from "@mui/material";
import { useState } from "react";
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
  coinbaseWalletSDK: coinbaseSvg,
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

  const handleConnect = async (connector: Connector) => {
    setError(null);

    try {
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
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mx: { xs: 4, md: 0 },
      }}
      slotProps={{
        backdrop: {
          sx: {
            background:
              "linear-gradient(180deg, rgba(255, 255, 255, 0.13) 0%, rgba(255, 255, 255, 0.13) 100%), rgba(16, 7, 53, 0.80)",
          },
        },
      }}
    >
      <Paper
        elevation={4}
        sx={{
          py: 5,
          px: { xs: 2, sm: 4 },
          width: 320,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          bgcolor: "background.default",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 4,
          position: "relative",
          boxShadow: "0px 0px 10px 0px rgba(255, 255, 255, 0.15)",
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            p: 0,
            color: "primary.main",
            position: "absolute",
            top: "16px",
            right: "16px",
            "&:hover": {
              bgcolor: "unset",
            },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          width="100%"
          display="flex"
          flexDirection="column"
          gap={1}
          mt={2}
        >
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                px: 3,
                py: 2,
                bgcolor: "rgba(255, 255, 255, 0.09)",
                color: "text.primary",
                borderRadius: "4px",
              }}
              onClick={() => {
                void handleConnect(connector);
              }}
            >
              <img
                src={connector.icon ?? WALLET_ICONS[connector.id]}
                alt={connector.id}
                width={24}
                height={24}
              />
              <span>{connector.name}</span>
            </Button>
          ))}
        </Box>
        <Typography color="text.primary" fontSize={11} mt={1.5}>
          By connecting a wallet, you agree to HUMAN Protocol Terms of Service
          and consent to its Privacy Policy.
        </Typography>
        {error && (
          <Typography color="error.main" fontSize={12} mt={1.5}>
            {error}
          </Typography>
        )}
      </Paper>
    </Modal>
  );
}
