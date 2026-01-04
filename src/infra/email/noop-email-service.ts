import { EmailService, VerificationEmailPayload } from './email-service';

export class NoopEmailService implements EmailService {
  async sendVerificationEmail(
    _payload: VerificationEmailPayload
  ): Promise<void> {
    // Intentionally do nothing
    // Used in tests and local dev
  }
}
