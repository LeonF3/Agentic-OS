import type { MailDetail, MailMessage } from "./schemas";
import { getGoogleAccessToken } from "./google-tokens";

function header(headers: Array<{ name?: string; value?: string }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(data?: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
}): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBody(payload.body.data);
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/html" && part.body?.data) return decodeBody(part.body.data);
  }
  if (payload.body?.data) return decodeBody(payload.body.data);
  return "";
}

export async function listGmailMessages(workspaceId: string, maxResults = 30): Promise<MailMessage[]> {
  const accessToken = await getGoogleAccessToken(workspaceId);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error("Failed to load Gmail inbox");
  const list = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const messages = list.messages ?? [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      };
      const headers = data.payload?.headers ?? [];
      return {
        id: data.id,
        threadId: data.threadId,
        subject: header(headers, "Subject") || "(no subject)",
        from: header(headers, "From"),
        snippet: data.snippet ?? "",
        date: header(headers, "Date"),
        unread: (data.labelIds ?? []).includes("UNREAD"),
      } satisfies MailMessage;
    })
  );

  return details.filter((m): m is MailMessage => m !== null);
}

export async function getGmailMessage(workspaceId: string, messageId: string): Promise<MailDetail> {
  const accessToken = await getGoogleAccessToken(workspaceId);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Message not found");
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    labelIds?: string[];
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    };
  };
  const headers = data.payload?.headers ?? [];
  return {
    id: data.id,
    threadId: data.threadId,
    subject: header(headers, "Subject") || "(no subject)",
    from: header(headers, "From"),
    to: header(headers, "To"),
    snippet: data.snippet ?? "",
    date: header(headers, "Date"),
    unread: (data.labelIds ?? []).includes("UNREAD"),
    body: extractBody(data.payload ?? {}),
  };
}
