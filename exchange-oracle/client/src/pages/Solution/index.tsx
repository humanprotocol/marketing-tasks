import React from "react";
import { Box, Container } from "@mui/material";
import { useAccount } from "wagmi";
import { FundingMethod } from "../../components/Wallet/FundingMethod";
import SolutionForm from "../../components/SolutionForm";
import { DefaultHeader } from "../../components/Headers/DefaultHeader";

const Solution: React.FC = () => {
  const { isConnected } = useAccount();

  return (
    <Box>
      <DefaultHeader />
      <Box
        sx={{
          px: { sm: 4, md: 8, xl: 30 },
          py: { xs: 12, sm: 16 },
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          minHeight: "100vh",
        }}
      >
        <Container
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            textAlign: "center",
          }}
        >
          {isConnected ? <SolutionForm /> : <FundingMethod />}
        </Container>
      </Box>
    </Box>
  );
};

export default Solution;
