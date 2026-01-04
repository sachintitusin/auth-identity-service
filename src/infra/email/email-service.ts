export type VerificationEmailPayload = {
  to: string;
  verificationLink: string;
  expiresAt: Date;
};

export interface EmailService {
  sendVerificationEmail(
    payload: VerificationEmailPayload
  ): Promise<void>;
}
