import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SkipLink } from "@/components/a11y/SkipLink";
import { auth } from "@/lib/auth";
import { buildInviteLoginHref } from "@/lib/invite-login-href";
import { normalizeEmail } from "@/lib/normalize-email";
import { getSignupInvitePreview } from "@/lib/signup-invite-preview";

import {
  AlreadyRegisteredInvite,
  type AlreadyRegisteredInviteMode,
} from "./accept-invite-form";
import { SignupForm } from "./signup-form";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SignupInvitePage({ params }: PageProps) {
  const { token } = await params;
  const preview = await getSignupInvitePreview(token);
  const session = await auth();
  const loginHref = buildInviteLoginHref(token);

  const sessionEmail = session?.user?.email ? normalizeEmail(session.user.email) : null;
  const invitedEmailNormalized =
    preview.status !== "invalid" ? normalizeEmail(preview.invitedEmail) : null;
  const sessionMatchesInvite =
    sessionEmail != null &&
    invitedEmailNormalized != null &&
    sessionEmail === invitedEmailNormalized;

  let alreadyRegisteredMode: AlreadyRegisteredInviteMode = "sign_in";
  if (sessionMatchesInvite) {
    alreadyRegisteredMode = "accept";
  } else if (sessionEmail && session?.user?.email) {
    alreadyRegisteredMode = "wrong_account";
  }

  return (
    <>
      <SkipLink />
      <Stack
        component="main"
        id="main-content"
        tabIndex={-1}
        spacing={3}
        sx={{
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 4,
          ...skipTargetMainSx,
        }}
      >
        <Typography variant="h4" component="h1">
          {preview.status === "already_registered" ? "Accept invitation" : "Create your account"}
        </Typography>

        {preview.status !== "invalid" && preview.league ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 420 }}>
            You&apos;re joining <strong>{preview.league.name}</strong>.
          </Typography>
        ) : null}

        {preview.status === "invalid" ? (
          <Alert severity="warning" sx={{ maxWidth: 400 }}>
            This invitation link is invalid or has expired. Ask your league admin for a new invite if
            you need access.
          </Alert>
        ) : preview.status === "already_registered" ? (
          <AlreadyRegisteredInvite
            mode={alreadyRegisteredMode}
            token={token}
            loginHref={loginHref}
            invitedEmail={preview.invitedEmail}
            currentEmail={session?.user?.email ?? undefined}
            leagueName={preview.league?.name ?? null}
          />
        ) : (
          <SignupForm
            token={token}
            invitedEmail={preview.invitedEmail}
            loginHref={loginHref}
          />
        )}
      </Stack>
    </>
  );
}
