import { AgentMailClient } from 'agentmail';

let client: AgentMailClient | null = null;

function getClient(): AgentMailClient {
  if (!client) {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      throw new Error('AGENTMAIL_API_KEY not set');
    }
    client = new AgentMailClient({ apiKey });
  }
  return client;
}

function getInboxEmail(): string {
  return process.env.AGENTMAIL_INBOX_EMAIL || 'news@agentmail.to';
}

export interface AgentMailMessage {
  inbox_id: string;
  thread_id: string;
  message_id: string;
  labels: string[];
  timestamp: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  preview?: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    attachment_id: string;
    size: number;
    inline: boolean;
    filename: string;
    content_type: string;
  }>;
}

export interface ListMessagesResponse {
  count: number;
  messages: AgentMailMessage[];
  limit?: number;
  next_page_token?: string;
}

export async function fetchMessages(pageToken?: string, limit = 50): Promise<ListMessagesResponse> {
  const agentmail = getClient();
  const inboxId = getInboxEmail();

  const response = await agentmail.inboxes.messages.list(inboxId, {
    limit,
    pageToken,
  });

  // Map from SDK's camelCase to our snake_case interface
  const messages: AgentMailMessage[] = response.messages.map(m => ({
    inbox_id: m.inboxId,
    thread_id: m.threadId,
    message_id: m.messageId,
    labels: m.labels as unknown as string[],
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    from: m.from,
    to: m.to as unknown as string[],
    cc: m.cc as unknown as string[] | undefined ?? undefined,
    bcc: m.bcc as unknown as string[] | undefined ?? undefined,
    subject: m.subject ?? '',
    preview: m.preview ?? undefined,
    text: undefined, // Not available in list response
    html: undefined, // Not available in list response
    attachments: m.attachments?.map(a => ({
      attachment_id: a.attachmentId,
      size: a.size,
      inline: a.inline,
      filename: a.filename ?? '',
      content_type: a.contentType ?? '',
    })),
  }));

  return {
    count: response.count,
    messages,
    limit: response.limit ?? undefined,
    next_page_token: response.nextPageToken ?? undefined,
  };
}

export async function getMessage(messageId: string): Promise<AgentMailMessage> {
  const agentmail = getClient();
  const inboxId = getInboxEmail();

  const message = await agentmail.inboxes.messages.get(inboxId, messageId);

  return {
    inbox_id: message.inboxId,
    thread_id: message.threadId,
    message_id: message.messageId,
    labels: message.labels as unknown as string[],
    timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : String(message.timestamp),
    from: message.from,
    to: message.to as unknown as string[],
    cc: message.cc as unknown as string[] | undefined ?? undefined,
    bcc: message.bcc as unknown as string[] | undefined ?? undefined,
    subject: message.subject ?? '',
    preview: message.preview ?? undefined,
    text: message.text ?? undefined,
    html: message.html ?? undefined,
    attachments: message.attachments?.map(a => ({
      attachment_id: a.attachmentId,
      size: a.size,
      inline: a.inline,
      filename: a.filename ?? '',
      content_type: a.contentType ?? '',
    })),
  };
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<{ message_id: string }> {
  const agentmail = getClient();
  const inboxId = getInboxEmail();

  const result = await agentmail.inboxes.messages.send(inboxId, {
    to: [to],
    subject,
    html,
    text: text || stripHtml(html),
  });

  return { message_id: result.messageId };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
