package httpapi

import "math"

func listingPriceBandForAmount(price float64) string {
	switch {
	case price <= 300_000:
		return "0-300000"
	case price <= 1_000_000:
		return "300000-1000000"
	case price <= 10_000_000:
		return "1000000-10000000"
	case price <= 30_000_000:
		return "10000000-30000000"
	case price <= 100_000_000:
		return "30000000-100000000"
	default:
		return "100000000-plus"
	}
}

// listingUploadFee validates the selected price band and calculates the
// one-time marketplace fee from the listing's full asking price.
func listingUploadFee(price float64, band string) (float64, bool) {
	if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
		return 0, false
	}
	var min, max, rate float64
	switch band {
	case "0-300000":
		min, max, rate = 0, 300_000, 0.01
	case "300000-1000000":
		min, max, rate = 300_000, 1_000_000, 0.02
	case "1000000-10000000":
		min, max, rate = 1_000_000, 10_000_000, 0.03
	case "10000000-30000000":
		min, max, rate = 10_000_000, 30_000_000, 0.031
	case "30000000-100000000":
		min, max, rate = 30_000_000, 100_000_000, 0.032
	case "100000000-plus":
		min, rate = 100_000_000, 0.012
	default:
		return 0, false
	}
	// Shared boundary values belong to the lower band, as shown in the pricing table.
	if (min > 0 && price <= min) || (max > 0 && price > max) {
		return 0, false
	}
	return math.Round(price*rate*100) / 100, true
}
