export type VerificationEmailPayload = {
  to: string;
  verificationLink: string;
  expiresAt: Date;
};

export type PasswordChangedEmailPayload = {
  to: string;
  changedAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

export interface EmailService {
  sendVerificationEmail(
    payload: VerificationEmailPayload
  ): Promise<void>;

  sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload
  ): Promise<void>;

}
