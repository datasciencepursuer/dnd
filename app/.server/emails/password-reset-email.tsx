import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
  Img,
} from "@react-email/components";

const logoUrl = "https://gn3amfywu8.ufs.sh/f/dWzugQGhzDaSG2hFjlV3WsDHwNF80yobV295vlqiRe6UxXjM";

interface PasswordResetEmailProps {
  url: string;
  userName?: string;
}

export function PasswordResetEmail({ url, userName }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password for bubufulplanet</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={logoUrl}
              alt="bubufulplanet"
              width="80"
              height="80"
              style={styles.logoImage}
            />
            <Text style={styles.logo}>bubufulplanet</Text>
          </Section>

          <Section style={styles.content}>
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.text}>
              {userName ? `Hi ${userName}, we` : "We"} received a request to reset your password.
              Click the button below to choose a new password.
            </Text>

            <Button style={styles.button} href={url}>
              Reset Password
            </Button>

            <Text style={styles.textSmall}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={styles.link}>{url}</Text>

            <Section style={styles.warningBox}>
              <Text style={styles.warningText}>
                This link will expire in 1 hour. If you didn't request a password reset,
                you can safely ignore this email.
              </Text>
            </Section>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              If you're having trouble, contact us for help.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "40px auto",
    padding: "0",
    maxWidth: "560px",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  header: {
    backgroundColor: "#1f2937",
    padding: "24px",
    borderRadius: "8px 8px 0 0",
    textAlign: "center" as const,
  },
  logoImage: {
    borderRadius: "12px",
    margin: "0 auto 12px auto",
    display: "block" as const,
  },
  logo: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "bold" as const,
    margin: 0,
  },
  content: {
    padding: "32px 40px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold" as const,
    color: "#1f2937",
    margin: "0 0 16px 0",
  },
  text: {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#4b5563",
    margin: "0 0 24px 0",
  },
  textSmall: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "#6b7280",
    margin: "24px 0 8px 0",
  },
  link: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "#2563eb",
    wordBreak: "break-all" as const,
    margin: 0,
  },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold" as const,
    textDecoration: "none",
    textAlign: "center" as const,
    padding: "12px 24px",
    display: "block",
  },
  warningBox: {
    backgroundColor: "#fef3c7",
    borderRadius: "6px",
    padding: "16px",
    marginTop: "24px",
  },
  warningText: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "#92400e",
    margin: 0,
  },
  hr: {
    borderColor: "#e5e7eb",
    margin: "0",
  },
  footer: {
    padding: "24px 40px",
  },
  footerText: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "#9ca3af",
    margin: 0,
    textAlign: "center" as const,
  },
};

export default PasswordResetEmail;
