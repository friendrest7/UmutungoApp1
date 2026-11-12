package httpapi

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/umutungo/umutungo/backend/internal/config"
)

var errInvalidEmail = errors.New("enter a valid email address")

func emailProviderConfigured(cfg config.Config) bool {
	return cfg.SMTPHost != "" && cfg.SMTPUsername != "" && cfg.SMTPPassword != "" && cfg.EmailFrom != ""
}

// normalizeEmail lowercases and validates an address. It rejects display-name
// forms ("Bob <bob@x.com>") and line breaks, so a user can't inject extra
// email headers.
func normalizeEmail(input string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(input))
	if value == "" || len(value) > 254 || strings.ContainsAny(value, "\r\n<>") {
		return "", errInvalidEmail
	}
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value || !strings.Contains(value[strings.LastIndex(value, "@")+1:], ".") {
		return "", errInvalidEmail
	}
	return value, nil
}

// sendVerificationEmail sends the code over SMTP. Port 465 uses TLS from the
// first byte; any other port (normally 587) upgrades to TLS with STARTTLS.
// The password is only ever sent over an encrypted connection.
func sendVerificationEmail(ctx context.Context, cfg config.Config, to, code string) error {
	if !emailProviderConfigured(cfg) {
		return errors.New("email delivery is not configured")
	}
	from, err := mail.ParseAddress(cfg.EmailFrom)
	if err != nil {
		return fmt.Errorf("EMAIL_FROM is not a valid address")
	}
	message := buildVerificationEmail(from, to, code, time.Now())

	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(20 * time.Second)
	}
	address := net.JoinHostPort(cfg.SMTPHost, cfg.SMTPPort)
	tlsConfig := &tls.Config{ServerName: cfg.SMTPHost, MinVersion: tls.VersionTLS12}
	dialer := &net.Dialer{Deadline: deadline}

	var conn net.Conn
	if cfg.SMTPPort == "465" {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", address)
	}
	if err != nil {
		return fmt.Errorf("connect to SMTP server: %w", err)
	}
	_ = conn.SetDeadline(deadline)
	client, err := smtp.NewClient(conn, cfg.SMTPHost)
	if err != nil {
		conn.Close()
		return fmt.Errorf("start SMTP session: %w", err)
	}
	defer client.Close()

	if cfg.SMTPPort != "465" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return errors.New("SMTP server does not offer STARTTLS; refusing to send the password unencrypted")
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS: %w", err)
		}
	}
	if err := client.Auth(smtp.PlainAuth("", cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPHost)); err != nil {
		return fmt.Errorf("SMTP login: %w", err)
	}
	if err := client.Mail(from.Address); err != nil {
		return fmt.Errorf("SMTP sender rejected: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("SMTP recipient rejected: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(message); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("SMTP message rejected: %w", err)
	}
	return client.Quit()
}

func buildVerificationEmail(from *mail.Address, to, code string, now time.Time) []byte {
	body := fmt.Sprintf("Hello,\r\n\r\nYour Umutungo verification code is:\r\n\r\n    %s\r\n\r\nIt expires in 10 minutes. If you did not ask for this code, you can ignore this email. Never share this code with anyone, including Umutungo staff.\r\n\r\nUmutungo\r\n", code)
	headers := []string{
		"From: " + from.String(),
		"To: " + to,
		"Subject: Your Umutungo verification code: " + code,
		"Date: " + now.UTC().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
	}
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body)
}
