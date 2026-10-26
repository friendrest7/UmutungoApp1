package httpapi

import (
	"errors"
	"math"
	"time"
	_ "time/tzdata"
)

const monthlyBookingDays = 30

type bookingQuote struct {
	PricingPeriod    string `json:"pricing_period"`
	RateAmount       int64  `json:"rate_amount"`
	BilledUnits      int    `json:"billed_units"`
	BaseAmount       int64  `json:"base_amount"`
	ServiceFeeAmount int64  `json:"service_fee_amount"`
	TotalAmount      int64  `json:"total_amount"`
	Currency         string `json:"currency"`
}

func parseBookingDates(checkInValue, checkOutValue string, now time.Time) (time.Time, time.Time, int, error) {
	checkIn, err := time.Parse("2006-01-02", checkInValue)
	if err != nil || checkIn.Format("2006-01-02") != checkInValue {
		return time.Time{}, time.Time{}, 0, errors.New("check_in must be an ISO date (YYYY-MM-DD)")
	}
	checkOut, err := time.Parse("2006-01-02", checkOutValue)
	if err != nil || checkOut.Format("2006-01-02") != checkOutValue {
		return time.Time{}, time.Time{}, 0, errors.New("check_out must be an ISO date (YYYY-MM-DD)")
	}
	if !checkOut.After(checkIn) {
		return time.Time{}, time.Time{}, 0, errors.New("check_out must be after check_in")
	}
	kigali, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		return time.Time{}, time.Time{}, 0, errors.New("Kigali timezone is unavailable")
	}
	today := now.In(kigali).Format("2006-01-02")
	if checkInValue < today {
		return time.Time{}, time.Time{}, 0, errors.New("check_in cannot be in the past")
	}
	nights := int(checkOut.Sub(checkIn).Hours() / 24)
	if nights > 3660 {
		return time.Time{}, time.Time{}, 0, errors.New("booking duration cannot exceed ten years")
	}
	return checkIn, checkOut, nights, nil
}

func calculateBookingQuote(rate int64, nights int, period string) (bookingQuote, error) {
	if rate <= 0 {
		return bookingQuote{}, errors.New("listing rate must be greater than zero")
	}
	if nights < 1 {
		return bookingQuote{}, errors.New("booking must include at least one night")
	}
	units := nights
	switch period {
	case "daily":
	case "monthly":
		units = (nights + monthlyBookingDays - 1) / monthlyBookingDays
	default:
		return bookingQuote{}, errors.New("pricing_period must be daily or monthly")
	}
	if int64(units) > math.MaxInt64/rate {
		return bookingQuote{}, errors.New("booking total exceeds the supported amount")
	}
	base := rate * int64(units)
	return bookingQuote{
		PricingPeriod: period, RateAmount: rate, BilledUnits: units,
		BaseAmount: base, ServiceFeeAmount: 0, TotalAmount: base, Currency: "RWF",
	}, nil
}

func bookingDateRangesOverlap(startA, endA, startB, endB time.Time) bool {
	return startA.Before(endB) && startB.Before(endA)
}
