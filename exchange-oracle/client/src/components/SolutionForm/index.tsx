import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSnackbar } from "../../providers/SnackProvider";
import { useAccount, useWalletClient } from "wagmi";
import * as jobService from "../../services/job";
import type { AssignmentDetails } from "../../services/job";

type SolutionCopy = {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  helperText: string;
  submitLabel: string;
};

const getBooleanRequirementLabels = (
  requirements: Record<string, unknown>,
): string[] => {
  const labels: Array<[string, string]> = [
    ["checkLike", "Like"],
    ["checkRepost", "Repost"],
    ["checkQuote", "Quote"],
    ["checkComment", "Comment"],
    ["requiresMedia", "Media required"],
    ["mustBePublic", "Public post"],
  ];

  return labels
    .filter(([key]) => requirements[key] === true)
    .map(([, label]) => label);
};

const getPlatformLabel = (platform?: string): string => {
  if (!platform) return "Social";
  if (platform.toLowerCase() === "x") return "X";
  if (platform.toLowerCase() === "linkedin") return "LinkedIn";
  return platform;
};

const getSolutionCopy = (
  assignment?: AssignmentDetails | null,
): SolutionCopy => {
  const platform = assignment?.platforms?.[0]?.toLowerCase();

  if (assignment?.jobType === "social_media_engagement") {
    if (platform === "x") {
      return {
        title: "Submit X Engagement",
        inputLabel: "X handle",
        inputPlaceholder: "@human_protocol",
        helperText: "Enter the X username that engaged with the target post.",
        submitLabel: "Submit handle",
      };
    }

    if (platform === "linkedin") {
      return {
        title: "Submit LinkedIn Engagement",
        inputLabel: "LinkedIn profile",
        inputPlaceholder: "https://www.linkedin.com/in/your-profile",
        helperText:
          "Enter your LinkedIn profile URL or public profile identifier.",
        submitLabel: "Submit profile",
      };
    }

    return {
      title: "Submit Engagement",
      inputLabel: "Social profile",
      inputPlaceholder: "Your profile handle or URL",
      helperText: "Enter the profile that completed the required engagement.",
      submitLabel: "Submit profile",
    };
  }

  if (platform === "linkedin") {
    return {
      title: "Submit LinkedIn Post",
      inputLabel: "Post URL",
      inputPlaceholder: "https://www.linkedin.com/posts/...",
      helperText: "Paste the public LinkedIn post URL for this assignment.",
      submitLabel: "Submit post",
    };
  }

  return {
    title: "Submit X Post",
    inputLabel: "Post URL",
    inputPlaceholder: "https://x.com/username/status/123",
    helperText: "Paste the public X post URL for this assignment.",
    submitLabel: "Submit post",
  };
};

const SolutionForm: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();

  const { address, chainId, connector, isConnected } = useAccount();
  const { data: signer } = useWalletClient({
    account: address,
    chainId,
    connector,
    query: {
      enabled: isConnected && !!address && !!connector,
    },
  });
  const [solution, setSolution] = useState("");
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const copy = useMemo(() => getSolutionCopy(assignment), [assignment]);
  const platformLabel = getPlatformLabel(assignment?.platforms?.[0]);
  const requirementLabels = useMemo(
    () =>
      assignment ? getBooleanRequirementLabels(assignment.requirements) : [],
    [assignment],
  );
  const targetPostUrl =
    typeof assignment?.requirements.targetPostUrl === "string"
      ? assignment.requirements.targetPostUrl
      : null;

  type SnackbarApi = {
    openSnackbar: (
      message: string,
      severity?: "success" | "error" | "info" | "warning",
    ) => void;
    showError: (error: unknown) => void;
  };

  const { showError, openSnackbar } = useSnackbar() as SnackbarApi;

  useEffect(() => {
    let isMounted = true;

    const loadAssignment = async () => {
      if (!assignmentId) {
        setIsLoadingAssignment(false);
        setAssignmentError("Missing assignment id");
        return;
      }

      try {
        setIsLoadingAssignment(true);
        const details = await jobService.getAssignmentDetails(assignmentId);
        if (isMounted) {
          setAssignment(details);
          setAssignmentError(null);
        }
      } catch {
        if (isMounted) {
          setAssignmentError("Assignment details could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingAssignment(false);
        }
      }
    };

    loadAssignment();

    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  const handleSubmit = async () => {
    if (!signer) {
      openSnackbar("Please connect your wallet first", "error");
      return;
    }

    if (!assignmentId) {
      openSnackbar("Missing assignment id", "error");
      return;
    }
    const message = {
      assignment_id: assignmentId,
      solution,
    };

    try {
      await jobService.solveJob(signer, message);

      openSnackbar("Solution sent successfully", "success");
    } catch (error) {
      showError(error);
    }
  };

  return (
    <Box
      width="100%"
      maxWidth="680px"
      sx={{
        p: { xs: 2, sm: 3 },
        background: "#fff",
        borderRadius: "8px",
        boxShadow:
          "0px 1px 5px 0px rgba(233, 235, 250, 0.20), 0px 2px 2px 0px rgba(233, 235, 250, 0.50), 0px 3px 1px -2px #E9EBFA",
      }}
    >
      {isLoadingAssignment ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <CircularProgress size={32} />
          <Typography color="text.secondary">Loading assignment</Typography>
        </Stack>
      ) : (
        <Stack spacing={3}>
          {assignmentError && (
            <Alert severity="warning">{assignmentError}</Alert>
          )}

          <Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Box>
                <Typography variant="h4" color="primary">
                  {copy.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Assignment #{assignmentId}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {assignment?.jobType && (
                  <Chip
                    size="small"
                    label={
                      assignment.jobType === "social_media_engagement"
                        ? "Engagement"
                        : "Promotion"
                    }
                  />
                )}
                <Chip size="small" color="primary" label={platformLabel} />
              </Stack>
            </Stack>

            {assignment?.jobDescription && (
              <Typography
                variant="body1"
                color="text.primary"
                sx={{ mt: 2, textAlign: "left" }}
              >
                {assignment.jobDescription}
              </Typography>
            )}
          </Box>

          <Divider />

          {(targetPostUrl || requirementLabels.length > 0) && (
            <Box
              sx={{
                background: "#fbfbfe",
                border: "1px solid #E9EBFA",
                borderRadius: "8px",
                p: 2,
                textAlign: "left",
              }}
            >
              <Stack spacing={1.5}>
                {targetPostUrl && (
                  <Link
                    href={targetPostUrl}
                    target="_blank"
                    rel="noreferrer"
                    display="inline-flex"
                    alignItems="center"
                    gap={0.75}
                    color="primary"
                    sx={{ wordBreak: "break-word" }}
                  >
                    Target post
                    <OpenInNewIcon fontSize="inherit" />
                  </Link>
                )}
                {requirementLabels.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {requirementLabels.map((label) => (
                      <Chip key={label} size="small" label={label} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          <TextField
            label={copy.inputLabel}
            placeholder={copy.inputPlaceholder}
            variant="outlined"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            helperText={copy.helperText}
            fullWidth
          />

          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={!signer || !assignmentId || !solution.trim()}
            startIcon={<SendIcon />}
          >
            {copy.submitLabel}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default SolutionForm;
