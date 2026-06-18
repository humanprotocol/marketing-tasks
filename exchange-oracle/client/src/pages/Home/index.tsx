import React from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { Outlet } from "react-router-dom";
import bagImg from "../../assets/bag.png";
import humanImg from "../../assets/human.png";
import userImg from "../../assets/user.png";
import { DefaultHeader } from "../../components/Headers/DefaultHeader";

const Home: React.FC = () => {
  return (
    <Box sx={{ minHeight: "100vh", background: "#0d0433" }}>
      <DefaultHeader />
      <Box
        sx={{
          px: { xs: 3, sm: 4, md: 10 },
          py: { xs: 12, md: 18 },
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          minHeight: "100vh",
        }}
      >
        <Grid container spacing={{ xs: 5, md: 8 }} maxWidth="1504px">
          <Grid item xs={12} sm={12} md={6}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
                {[bagImg, userImg, humanImg].map((image, index) => (
                  <Box
                    key={image}
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: "8px",
                      background: "#271f4f",
                      border: "1px solid #3f3569",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      ml: index === 0 ? 0 : -2,
                    }}
                  >
                    <img src={image} alt="" style={{ maxWidth: 56 }} />
                  </Box>
                ))}
              </Stack>
              <Typography
                color="text.primary"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: "44px", sm: "64px", md: "80px" },
                  lineHeight: 1,
                }}
              >
                <b>HUMAN</b>
                <br />
                Exchange Oracle
              </Typography>
              <Typography
                color="text.secondary"
                variant="h5"
                fontWeight={600}
                my={3}
                maxWidth="520px"
              >
                Review the job details, submit the right social proof, and send
                it for validation.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={12} md={6}>
            <Outlet />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Home;
