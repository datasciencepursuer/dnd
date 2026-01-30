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

interface VerificationEmailProps {
  url: string;
  userName?: string;
}

export function VerificationEmail({ url, userName }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email for bubufulplanet</Preview>
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
            <Text style={styles.title}>Welcome{userName ? `, ${userName}` : ""}!</Text>
            <Text style={styles.text}>
              Thanks for signing up. Please verify your email address by clicking the button below.
            </Text>

            <Button style={styles.button} href={url}>
              Verify Email
            </Button>

            <Text style={styles.textSmall}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={styles.link}>{url}</Text>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              If you didn't create an account, you can safely ignore this email.
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
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold" as const,
    textDecoration: "none",
    textAlign: "center" as const,
    padding: "12px 24px",
    display: "block",
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

export default VerificationEmail;
