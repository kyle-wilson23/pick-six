import { getPasswordResetPreview } from "@/lib/password-reset-preview";

import { ResetPasswordClient } from "./reset-password-client";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;
  const preview = await getPasswordResetPreview(token);

  return <ResetPasswordClient token={token} isValid={preview.status === "valid"} />;
}
