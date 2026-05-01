// Tiny transactional-mail helper.
//
// When SMTP_URL is set in the environment a real message is sent via nodemailer
// using the URL as the transport DSN (smtp://user:pass@host:port).
//
// When SMTP_URL is absent the payload is logged at info level so an operator
// running `docker compose logs` can copy-paste reset URLs without needing an
// SMTP server in development or single-node installs.

import nodemailer from "nodemailer";

import { env } from "@/env";
import { logger } from "@/lib/log";

const log = logger("mail");

export type MailPayload = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

export const sendMail = async (payload: MailPayload): Promise<void> => {
    const { to, subject, text, html } = payload;

    if (!env.SMTP_URL) {
        // No SMTP configured — log the full payload so operators can action it.
        log.info("would-send email (set SMTP_URL to deliver for real)", {
            to,
            subject,
            body: text,
        });
        return;
    }

    const from = env.MAIL_FROM ?? "cassette <noreply@cassette.local>";

    const transport = nodemailer.createTransport(env.SMTP_URL);

    await transport.sendMail({
        from,
        to,
        subject,
        text,
        html: html ?? undefined,
    });

    log.info("sent email", { to, subject });
};
