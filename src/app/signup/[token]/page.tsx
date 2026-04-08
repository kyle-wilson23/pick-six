import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { getSignupInvitePreview } from "@/lib/invitations";

import { SignupForm } from "./signup-form";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SignupInvitePage({ params }: PageProps) {
  const { token } = await params;
  const preview = await getSignupInvitePreview(token);

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h4" component="h1">
        Create your account
      </Typography>

      {preview.status === "invalid" ? (
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          This invitation link is invalid or has expired. Ask your league admin for a new invite if
          you need access.
        </Alert>
      ) : (
        <SignupForm token={token} invitedEmail={preview.invitedEmail} />
      )}
    </Stack>
  );
}
