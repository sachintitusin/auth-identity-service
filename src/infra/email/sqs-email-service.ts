import { EmailService, VerificationEmailPayload } from './email-service';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export class SQSEmailService implements EmailService {
  private sqs: SQSClient;
  private queueUrl: string;

  constructor() {
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION,
    });

    if (!process.env.EMAIL_DELIVERY_QUEUE_URL) {
      throw new Error('EMAIL_DELIVERY_QUEUE_URL not configured');
    }

    this.queueUrl = process.env.EMAIL_DELIVERY_QUEUE_URL;
  }

  async sendVerificationEmail(
    payload: VerificationEmailPayload
  ): Promise<void> {
    const message = {
      type: 'EMAIL_VERIFICATION',
      to: payload.to,
      verificationLink: payload.verificationLink,
      expiresAt: payload.expiresAt.toISOString(), // serialize for queue
    };

    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      })
    );
  }
}
