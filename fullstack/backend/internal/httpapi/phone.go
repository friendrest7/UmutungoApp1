package httpapi

import (
	"errors"
	"strings"

	"github.com/nyaruka/phonenumbers"
)

var errInvalidPhone = errors.New("enter a valid mobile number, including the country code if it is not a Rwanda number")

// normalizePhone turns any valid phone number into E.164 form ("+250788123456").
//
// It uses phonenumbers, a Go port of Google's libphonenumber, which knows the
// numbering rules of every country, so "+1 202 555 0143" and "+44 7700 900123"
// work as well as Rwanda numbers. A number written without a country code
// ("0788 123 456") is read as a Rwanda number, since most users are in Rwanda.
//
// normalizeRwandaPhone (mtn_sms.go) stays as-is for MTN MoMo payments, which
// only work with Rwanda numbers.
func normalizePhone(input string) (string, error) {
	input = strings.TrimSpace(input)
	if input == "" || len(input) > 32 {
		return "", errInvalidPhone
	}
	if strings.HasPrefix(input, "00") {
		input = "+" + strings.TrimPrefix(input, "00")
	}
	// People often type Rwanda numbers as "250788123456" without the "+".
	if digits := strings.NewReplacer(" ", "", "-", "").Replace(input); len(digits) == 12 && strings.HasPrefix(digits, "250") {
		input = "+" + digits
	}
	parsed, err := phonenumbers.Parse(input, "RW")
	if err != nil || !phonenumbers.IsValidNumber(parsed) {
		return "", errInvalidPhone
	}
	return phonenumbers.Format(parsed, phonenumbers.E164), nil
}
