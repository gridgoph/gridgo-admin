import { useAuth, useClerk, useSignIn } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { AuthDivider } from "@/components/AuthDivider";
import { CodeField } from "@/components/CodeField";
import { FormScroll } from "@/components/FormScroll";
import { GoogleButton } from "@/components/GoogleButton";
import { GridgoLogo } from "@/components/GridgoLogo";
import { InlineNotice } from "@/components/InlineNotice";
import { PasswordField } from "@/components/PasswordField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { fieldInputStyle } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useTheme";
import { clerkErrorMessage } from "@/lib/clerkAuth";
import {
  clerkSignOutRecoveryMessage,
  continuationAfterPassword,
  loginVerifyCopy,
  type ClerkSecondFactorStrategy,
} from "@/lib/clerkSignIn";
import { completeGoogleSso } from "@/lib/googleSso";

const CODE_LENGTH = 6;
/**
 * Fills the space between the intro and the form: it grows on a tall phone up
 * to its cap and shrinks on a small one. With the keyboard open the form
 * scrolls over it rather than squeezing it.
 */
const ILLUSTRATION = { flex: 1, width: "100%", maxHeight: 300 } as const;
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Sign in with the existing GRIDGO account — the same Clerk instance as every
 * other GRIDGO app. There is no sign-up here: access comes from an invite,
 * redeemed after signing in. The flow is gridgo-rider's Clerk path (password,
 * then any second factor Clerk asks for, or Google).
 */
export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useAuth();
  const { setActive, signOut } = useClerk();
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<ClerkSecondFactorStrategy>("email_code");
  const [resendIn, setResendIn] = useState(0);
  const passwordField = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendSecondFactor(next: ClerkSecondFactorStrategy) {
    if (!signIn) return;
    if (next === "phone_code") {
      const sent = await signIn.mfa.sendPhoneCode();
      if (sent.error) throw sent.error;
    } else if (next === "email_code") {
      const sent = await signIn.mfa.sendEmailCode();
      if (sent.error) throw sent.error;
    }
  }

  async function continueAfterPassword(retried: boolean): Promise<void> {
    if (!signIn) return;
    const next = continuationAfterPassword(
      signIn.status,
      signIn.existingSession,
      signIn.supportedSecondFactors,
    );
    if (next.kind === "existing_session") {
      if (!retried) {
        try {
          await signOut();
        } catch {
          setError(clerkSignOutRecoveryMessage);
          return;
        }
        setBusy(false);
        await submitPassword(true);
        return;
      }
      await setActive({ session: next.sessionId });
      return;
    }
    if (next.kind === "blocked") {
      setError(next.message);
      return;
    }
    if (next.kind === "verification") {
      await sendSecondFactor(next.factor);
      setFactor(next.factor);
      setCode("");
      setVerifying(true);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      return;
    }
    const completed = await signIn.finalize();
    if (completed.error) throw completed.error;
  }

  async function submitPassword(retried = false) {
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    setError(null);
    if (!normalized || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!signIn || fetchStatus === "fetching") return;
    setBusy(true);
    try {
      const attempt = await signIn.password({ emailAddress: normalized, password });
      if (attempt.error) throw attempt.error;
      await continueAfterPassword(retried);
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Wrong email or password."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    const typed = code.replace(/\D/g, "");
    if (!signIn || typed.length < CODE_LENGTH || busy) return;
    setError(null);
    setBusy(true);
    try {
      const checked =
        factor === "phone_code"
          ? await signIn.mfa.verifyPhoneCode({ code: typed })
          : factor === "totp"
            ? await signIn.mfa.verifyTOTP({ code: typed })
            : factor === "backup_code"
              ? await signIn.mfa.verifyBackupCode({ code: typed })
              : await signIn.mfa.verifyEmailCode({ code: typed });
      if (checked.error) throw checked.error;
      if (signIn.status !== "complete") {
        throw new Error("That code did not match. Check the six digits, or send another.");
      }
      const completed = await signIn.finalize();
      if (completed.error) throw completed.error;
    } catch (caught) {
      setCode("");
      setError(clerkErrorMessage(caught, "That code did not match. Check the six digits, or send another."));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!signIn || busy || resendIn > 0) return;
    setError(null);
    setCode("");
    setBusy(true);
    try {
      await sendSecondFactor(factor);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      setError(clerkErrorMessage(caught, "GRIDGO could not send another code. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await completeGoogleSso({
        alreadySignedIn: Boolean(isSignedIn),
        startSSOFlow: () => startSSOFlow({ strategy: "oauth_google" }),
        setActive: (args) => setActive(args),
      });
    } catch (caught) {
      setError(clerkErrorMessage(caught, "Google sign in did not go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (verifying) {
    const copy = loginVerifyCopy(factor, email);
    return (
      <Screen>
        <FormScroll contentClassName="gg-page grow gap-8 py-6">
          <View className="gap-6 pt-6">
            <GridgoLogo role="admin" size={22} />
            <View className="gap-2">
              <Text className="text-h1 text-text-primary">{copy.heading}</Text>
              <Text className="text-body-lg text-text-secondary">{copy.body}</Text>
            </View>
          </View>
          <View className="gap-4">
            <CodeField
              value={code}
              onChangeText={(next) => {
                setCode(next);
                setError(null);
              }}
              length={CODE_LENGTH}
              invalid={Boolean(error)}
              onComplete={() => void verifyCode()}
              autoFocus
              accessibilityLabel="Sign-in code"
              testID="sign-in-code"
            />
            {error ? (
              <InlineNotice tone="error" icon="circle-x" title="Code not accepted" body={error} />
            ) : null}
            <PrimaryButton
              label={busy ? "Signing in…" : "Sign in"}
              onPress={() => void verifyCode()}
              disabled={busy || code.length < CODE_LENGTH}
              size="large"
            />
            <View className="items-center">
              {copy.resend ? (
                <Pressable
                  onPress={() => void resendCode()}
                  disabled={busy || resendIn > 0}
                  accessibilityRole="button"
                  className="min-h-11 items-center justify-center"
                >
                  <Text className={resendIn > 0 ? "text-button text-text-muted" : "text-button text-text-primary"}>
                    {resendIn > 0 ? `Send another code in ${resendIn}s` : "Send another code"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setVerifying(false);
                  setCode("");
                  setError(null);
                }}
                disabled={busy}
                accessibilityRole="button"
                className="min-h-11 items-center justify-center"
              >
                <Text className="text-body text-text-secondary">Use a different email</Text>
              </Pressable>
            </View>
          </View>
        </FormScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <FormScroll contentClassName="gg-page grow justify-between gap-8 py-6">
        <View className="gap-6 pt-6">
          <GridgoLogo role="admin" size={22} />
          <View className="gap-2">
            <Text className="text-h1 text-text-primary" accessibilityRole="header">
              Staff sign in
            </Text>
            <Text className="text-body-lg text-text-secondary">
              Use your GRIDGO account. New staff sign in first, then enter the invite code GRIDGO sent.
            </Text>
          </View>
        </View>

        <View className="min-h-32 flex-1 items-center justify-center">
          <Image
            source={require("@/assets/images/sign-in-illustration.webp")}
            style={ILLUSTRATION}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            testID="sign-in-illustration"
          />
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-body font-medium text-text-primary">Email</Text>
            <TextInput
              className="gg-field"
              style={fieldInputStyle}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Email"
              returnKeyType="next"
              onSubmitEditing={() => passwordField.current?.focus()}
            />
          </View>
          <View className="gap-2">
            <Text className="text-body font-medium text-text-primary">Password</Text>
            <PasswordField
              ref={passwordField}
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              placeholder="Your password"
              accessibilityLabel="Password"
              returnKeyType="go"
              textContentType="password"
              onSubmitEditing={() => void submitPassword()}
            />
          </View>
          {error ? (
            <InlineNotice tone="error" icon="circle-x" title="Not signed in" body={error} />
          ) : null}
          <PrimaryButton
            label={busy ? "Signing in…" : "Sign in"}
            onPress={() => void submitPassword()}
            disabled={busy}
            size="large"
          />
          <AuthDivider />
          <GoogleButton onPress={() => void continueWithGoogle()} disabled={busy} />
        </View>
      </FormScroll>
    </Screen>
  );
}
