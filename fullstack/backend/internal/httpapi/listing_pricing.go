package httpapi

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
