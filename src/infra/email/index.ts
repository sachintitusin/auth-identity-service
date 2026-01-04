import { EmailService } from './email-service';
import { NoopEmailService } from './noop-email-service';

let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailService) {
    return emailService;
  }

  // Default: noop
  // Later we’ll switch based on env (SES, SMTP, queue, etc.)
  emailService = new NoopEmailService();

  return emailService;
}
