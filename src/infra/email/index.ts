import { EmailService } from './email-service';
import { NoopEmailService } from './noop-email-service';
import { SQSEmailService } from './sqs-email-service';

let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailService) {
    return emailService;
  }

  const mode = process.env.EMAIL_DELIVERY_MODE ?? 'noop';

  switch (mode) {
    case 'sqs': {
      emailService = new SQSEmailService();
      break;
    }

    case 'noop':
    default: {
      emailService = new NoopEmailService();
      break;
    }
  }

  return emailService;
}
