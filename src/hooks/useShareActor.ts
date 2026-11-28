import { useCallback, useMemo, useState } from "react";
import { memberDisplayName, normalizeEmail } from "@/domain/rules/groceryShareRules";
import { useSession } from "@/providers/AuthProvider";
import { refreshEmailVerification } from "@/services/authService";
import type { ShareActor } from "@/services/groceryShareService";

/**
 * Quem esta usando o app, como aparece no compartilhamento (uid, nome, e-mail),
 * e se o e-mail esta confirmado — exigido pelas regras para receber convites.
 */
export function useShareActor() {
  const { profile, firebaseUser } = useSession();
  const email = normalizeEmail(firebaseUser.email ?? profile.email);
  const [verifiedNow, setVerifiedNow] = useState(false);
  const emailVerified = firebaseUser.emailVerified === true || verifiedNow;

  const actor = useMemo<ShareActor>(
    () => ({ uid: profile.userId, name: memberDisplayName(profile.displayName, email), email }),
    [email, profile.displayName, profile.userId],
  );

  /** Confere de novo apos a pessoa clicar no link do e-mail. */
  const recheckEmail = useCallback(async () => {
    const verified = await refreshEmailVerification();
    if (verified) setVerifiedNow(true);
    return verified;
  }, []);

  return { actor, emailVerified, recheckEmail };
}
