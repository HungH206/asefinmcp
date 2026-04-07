import { google } from "googleapis"

export interface GmailSendOptions {
  accessToken: string
  to: string
  subject: string
  body: string
}

function encodeEmail(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ]
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function sendGmail({ accessToken, to, subject, body }: GmailSendOptions) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: "v1", auth })

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeEmail(to, subject, body) },
  })

  return { messageId: res.data.id, threadId: res.data.threadId }
}
