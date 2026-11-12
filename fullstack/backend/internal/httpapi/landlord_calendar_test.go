package httpapi

import (
	"testing"
	"time"
)

func kigali(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.ParseInLocation("2006-01-02 15:04", value, kigaliTime)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func TestTrialFollowsKigaliCalendar(t *testing.T) {
	// Granted at 08:50 on 12 November: 12 Nov is day 1, 11 Dec is day 30,
	// access closes at midnight as 12 December begins.
	start, end := trialPeriod(kigali(t, "2026-11-12 08:50"), 30)
	if got := start.Format("2006-01-02 15:04"); got != "2026-11-12 00:00" {
		t.Fatalf("start = %s", got)
	}
	if got := end.In(kigaliTime).Format("2006-01-02 15:04"); got != "2026-12-12 00:00" {
		t.Fatalf("end = %s", got)
	}
	// 23:30 Kigali is 21:30 UTC on the same day; the day must still be Kigali's.
	lateStart, _ := trialPeriod(time.Date(2026, 11, 12, 21, 30, 0, 0, time.UTC), 30)
	if got := lateStart.Format("2006-01-02"); got != "2026-11-12" {
		t.Fatalf("late start day = %s", got)
	}
	// And 22:30 UTC is already 13 November in Kigali.
	nextDay, _ := trialPeriod(time.Date(2026, 11, 12, 22, 30, 0, 0, time.UTC), 30)
	if got := nextDay.Format("2006-01-02"); got != "2026-11-13" {
		t.Fatalf("after-midnight start day = %s", got)
	}

	cases := []struct {
		now            string
		day, left      int
		today, lastDay string
	}{
		{"2026-11-12 08:51", 1, 30, "2026-11-12", "2026-12-11"},
		{"2026-11-12 23:59", 1, 30, "2026-11-12", "2026-12-11"},
		{"2026-11-13 00:00", 2, 29, "2026-11-13", "2026-12-11"},
		{"2026-11-30 12:00", 19, 12, "2026-11-30", "2026-12-11"},
		{"2026-12-11 23:59", 30, 1, "2026-12-11", "2026-12-11"},
	}
	for _, c := range cases {
		var access landlordAccess
		fillCalendar(&access, &start, &end, kigali(t, c.now))
		if access.DayNumber != c.day || access.DaysLeft != c.left || access.Today != c.today || access.LastDay != c.lastDay || access.FirstDay != "2026-11-12" || access.PeriodDays != 30 {
			t.Errorf("%s: got day %d/%d, %d left, today %s, %s..%s", c.now, access.DayNumber, access.PeriodDays, access.DaysLeft, access.Today, access.FirstDay, access.LastDay)
		}
	}
}

func TestCalendarForPlanEndingMidDay(t *testing.T) {
	// A paid plan that ends at 14:00 still has that day as its last day.
	start, end := kigali(t, "2026-11-01 14:00"), kigali(t, "2026-12-01 14:00")
	var access landlordAccess
	fillCalendar(&access, &start, &end, kigali(t, "2026-12-01 09:00"))
	if access.LastDay != "2026-12-01" || access.DaysLeft != 1 || access.PeriodDays != 31 || access.DayNumber != 31 {
		t.Fatalf("got %+v", access)
	}
}
