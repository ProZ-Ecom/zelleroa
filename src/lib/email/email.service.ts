import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  getRegistrationOtpEmailTemplate,
  getForgotPasswordOtpEmailTemplate,
} from "./templates/otp-email.template";
import {
  getContactAcknowledgementEmailTemplate,
  getContactReplyEmailTemplate,
} from "./templates/contact-email.template";

export const emailService = {
  getFromAddress(): string {
    const fromName = process.env.SMTP_FROM_NAME || "Zellora";
    const fromEmail =
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_USER ||
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USER ||
      "info@zellora.in";

    return fromEmail.includes("<")
      ? fromEmail
      : `"${fromName.replace(/"/g, "")}" <${fromEmail}>`;
  },

  getTransporter(): Transporter | null {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const portStr = process.env.SMTP_PORT || process.env.EMAIL_PORT;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;
    const secureEnv = process.env.SMTP_SECURE;

    if (
      !host ||
      !user ||
      !pass ||
      host.includes("your-") ||
      user.includes("your-") ||
      pass.includes("your-")
    ) {
      return null;
    }

    const port = Number(portStr) || 465;
    // Hostinger port 465 uses SSL/TLS (secure: true); port 587 uses STARTTLS (secure: false)
    const secure =
      secureEnv !== undefined
        ? secureEnv === "true" || secureEnv === "1"
        : port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      socketTimeout: 15000,
    });
  },

  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        success: false,
        message: "SMTP configuration is incomplete or missing in environment variables.",
      };
    }

    try {
      await transporter.verify();
      return {
        success: true,
        message: "SMTP connection verified successfully with Hostinger.",
      };
    } catch (error: any) {
      console.error("[EMAIL SERVICE] SMTP verification failed:", error);
      return {
        success: false,
        message: error?.message || "Failed to verify SMTP connection.",
      };
    }
  },

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    const from = this.getFromAddress();
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn("[EMAIL SERVICE] SMTP is not configured; email was not sent.");
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      console.log(
        `[EMAIL SERVICE] Email sent to ${options.to} (MessageId: ${info.messageId})`
      );
      return true;
    } catch (error) {
      console.error("[EMAIL SERVICE] Error sending email:", error);
      return false;
    }
  },

  async sendOtpEmail(
    to: string,
    otp: string,
    purpose: "register" | "reset_password" = "register"
  ): Promise<boolean> {
    const { subject, html, text } =
      purpose === "register"
        ? getRegistrationOtpEmailTemplate(otp)
        : getForgotPasswordOtpEmailTemplate(otp);

    const from = this.getFromAddress();
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn(
        `[EMAIL SERVICE] SMTP is not configured; ${purpose} OTP email was not sent.`
      );
      return false;
    }

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      console.error("[EMAIL SERVICE] Error sending email:", error);
      return false;
    }
  },

  async sendContactAcknowledgementEmail(
    to: string,
    name: string,
    contactSubject?: string | null
  ): Promise<boolean> {
    const { subject, html, text } = getContactAcknowledgementEmailTemplate({
      name,
      subject: contactSubject,
    });

    const from = this.getFromAddress();
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn(
        "[EMAIL SERVICE] SMTP is not configured; contact acknowledgement email was not sent."
      );
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(
        `[EMAIL SERVICE] Contact acknowledgement email sent to ${to} (MessageId: ${info.messageId})`
      );
      return true;
    } catch (error) {
      console.error(
        "[EMAIL SERVICE] Error sending contact acknowledgement email:",
        error
      );
      return false;
    }
  },

  async sendContactReplyEmail(
    to: string,
    name: string,
    originalSubject: string | null | undefined,
    replyMessage: string
  ): Promise<boolean> {
    const { subject, html, text } = getContactReplyEmailTemplate({
      name,
      originalSubject,
      replyMessage,
    });

    const from = this.getFromAddress();
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn(
        "[EMAIL SERVICE] SMTP is not configured; contact reply email was not sent."
      );
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(
        `[EMAIL SERVICE] Contact reply email sent to ${to} (MessageId: ${info.messageId})`
      );
      return true;
    } catch (error) {
      console.error(
        "[EMAIL SERVICE] Error sending contact reply email:",
        error
      );
      return false;
    }
  },
};
