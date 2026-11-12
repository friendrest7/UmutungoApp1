package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

// Landlord accounts have no free tier:
//   - the first time a landlord opens the workspace they get one Silver trial;
//   - while a trial or paid plan is active the workspace is open;
//   - otherwise the workspace is locked until they buy a plan.
//
// Upgrades, renewals and downgrades use the existing business plan flow
// (business_subscriptions.go): upgrades apply immediately, a renewal or
// downgrade starts when the current period (including a trial) ends.

const defaultLandlordTrialDays = 30

type landlordAccess struct {
	Required    bool       `json:"required"`
	State       string     `json:"state"` // "active", "trial" or "locked"
	Tier        string     `json:"tier"`
	Label       string     `json:"label"`
	IsTrial     bool       `json:"is_trial"`
	TrialUsed   bool       `json:"trial_used"`
	TrialDays   int        `json:"trial_days"`
	StartsAt    *time.Time `json:"starts_at"`
	EndsAt      *time.Time `json:"ends_at"`
	DaysLeft    int        `json:"days_left"`
	// Calendar view of the current period, in Kigali dates (YYYY-MM-DD).
	// FirstDay..LastDay are the days the plan covers; Today is day DayNumber
	// of PeriodDays.
	FirstDay    string     `json:"first_day"`
	LastDay     string     `json:"last_day"`
	Today       string     `json:"today"`
	DayNumber   int        `json:"day_number"`
	PeriodDays  int        `json:"period_days"`
	ScheduledAt *time.Time `json:"scheduled_tier_starts_at"`
	Scheduled   string     `json:"scheduled_tier"`
}

// Plans follow the Rwanda calendar. A trial starts at the beginning of the day
// it is granted (that day is day 1) and ends at midnight Kigali time after its
// last day, so a 30-day trial started on 12 November covers 12 November to
// 11 December and closes as 12 December begins.
var kigaliTime = func() *time.Location {
	location, err := time.LoadLocation("Africa/Kigali")
	if err != nil { // Rwanda has no daylight saving: UTC+2 all year.
		return time.FixedZone("CAT", 2*60*60)
	}
	return location
}()

// kigaliDay returns midnight (Kigali) at the start of the day containing t.
func kigaliDay(t time.Time) time.Time {
	local := t.In(kigaliTime)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, kigaliTime)
}

// calendarDaysBetween counts whole calendar days from day a to day b.
func calendarDaysBetween(a, b time.Time) int {
	return int(math.Round(kigaliDay(b).Sub(kigaliDay(a)).Hours() / 24))
}

// trialPeriod is the start and end of a trial of the given number of
// calendar days granted at now.
func trialPeriod(now time.Time, days int) (time.Time, time.Time) {
	start := kigaliDay(now)
	return start, start.AddDate(0, 0, days)
}

// fillCalendar sets the calendar fields of access from the period start/end.
// The last day is the day before the end instant (an end at midnight belongs
// to the previous day).
func fillCalendar(access *landlordAccess, startsAt, endsAt *time.Time, now time.Time) {
	if endsAt == nil {
		return
	}
	lastDay := kigaliDay(endsAt.Add(-time.Nanosecond))
	firstDay := kigaliDay(now)
	if startsAt != nil {
		firstDay = kigaliDay(*startsAt)
	}
	access.FirstDay = firstDay.Format("2006-01-02")
	access.LastDay = lastDay.Format("2006-01-02")
	access.Today = kigaliDay(now).Format("2006-01-02")
	access.PeriodDays = calendarDaysBetween(firstDay, lastDay) + 1
	access.DayNumber = min(max(calendarDaysBetween(firstDay, now)+1, 1), access.PeriodDays)
	access.DaysLeft = max(calendarDaysBetween(now, lastDay)+1, 0)
}

func (s *Server) landlordTrialDays(ctx context.Context, q rowQuerier) int {
	var days int
	if err := q.QueryRow(ctx, `SELECT (value #>> '{}')::int FROM platform_settings WHERE key='landlord_trial_days'`).Scan(&days); err != nil || days < 1 || days > 366 {
		return defaultLandlordTrialDays
	}
	return days
}

// ensureLandlordTrial grants the one-time Silver trial. It is idempotent and
// safe under concurrent requests: the user row is locked and landlord_trials
// has the user as its primary key.
func (s *Server) ensureLandlordTrial(ctx context.Context, user CurrentUser) error {
	if businessRoleFor(user) != "landlord" {
		return nil
	}
	var done bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM landlord_trials WHERE user_id=$1)`, user.ID).Scan(&done); err != nil || done {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id=$1 FOR UPDATE`, user.ID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM landlord_trials WHERE user_id=$1)`, user.ID).Scan(&done); err != nil || done {
		return err
	}
	// Landlords who already bought a plan do not need a trial.
	var hadPlan bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=$1 AND business_role='landlord' AND status IN ('active','expired','superseded'))`, user.ID).Scan(&hadPlan); err != nil {
		return err
	}
	if hadPlan {
		if _, err := tx.Exec(ctx, `INSERT INTO landlord_trials(user_id,outcome) VALUES($1,'skipped')`, user.ID); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	terms, err := currentPlanTerms(ctx, tx, "landlord", "silver")
	if err != nil {
		return fmt.Errorf("load silver plan terms: %w", err)
	}
	days := s.landlordTrialDays(ctx, tx)
	terms.PeriodDays = days
	snapshot, _ := json.Marshal(terms)
	now, endsAt := trialPeriod(time.Now(), days)
	var subscriptionID string
	if err := tx.QueryRow(ctx, `INSERT INTO subscriptions(user_id,tier,status,business_role,plan_version_id,amount,currency,entitlements,change_kind,starts_at,ends_at,activated_at,is_trial)
		VALUES($1,'silver','active','landlord',$2,0,'RWF',$3,'new',$4,$5,NOW(),TRUE) RETURNING id::text`, user.ID, terms.PlanVersionID, snapshot, now, endsAt).Scan(&subscriptionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO landlord_trials(user_id,subscription_id,outcome) VALUES($1,$2,'granted')`, user.ID, subscriptionID); err != nil {
		return err
	}
	lastDay := endsAt.AddDate(0, 0, -1)
	body := fmt.Sprintf("Your free %d-day %s trial has started. Today is day 1 and %s is your last day. Choose a plan before then to keep using your workspace.", days, terms.Label, lastDay.Format("2 Jan 2006"))
	if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'subscription_trial','Your Silver trial has started',$2)`, user.ID, body); err != nil {
		return err
	}
	if err := writeAudit(ctx, tx, user.ID, "subscription.trial_started", "subscription", subscriptionID, nil, map[string]any{"tier": "silver", "business_role": "landlord", "ends_at": endsAt, "days": days}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// resolveLandlordAccess reports whether the landlord workspace is open.
// Accounts that are not landlords are never gated here.
func (s *Server) resolveLandlordAccess(ctx context.Context, user CurrentUser) (landlordAccess, error) {
	access := landlordAccess{State: "active", TrialDays: s.landlordTrialDays(ctx, s.db)}
	if businessRoleFor(user) != "landlord" {
		return access, nil
	}
	access.Required = true
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM landlord_trials WHERE user_id=$1 AND outcome='granted')`, user.ID).Scan(&access.TrialUsed); err != nil {
		return access, err
	}
	var subscriptionID string
	err := s.db.QueryRow(ctx, `SELECT id::text,tier,is_trial,starts_at,ends_at,COALESCE(entitlements->>'label','') FROM subscriptions
		WHERE user_id=$1 AND business_role='landlord' AND status='active'
		AND (starts_at IS NULL OR starts_at <= NOW()) AND ends_at > NOW()
		ORDER BY CASE tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 1 END DESC, ends_at DESC LIMIT 1`, user.ID).
		Scan(&subscriptionID, &access.Tier, &access.IsTrial, &access.StartsAt, &access.EndsAt, &access.Label)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		access.State, access.Tier = "locked", "none"
		return access, nil
	case err != nil:
		return access, err
	}
	if access.IsTrial {
		access.State = "trial"
	}
	fillCalendar(&access, access.StartsAt, access.EndsAt, time.Now())
	// A plan bought during a trial or before a downgrade starts later.
	var scheduledTier string
	var scheduledAt *time.Time
	if err := s.db.QueryRow(ctx, `SELECT tier,starts_at FROM subscriptions WHERE user_id=$1 AND business_role='landlord' AND status='active' AND starts_at > NOW() ORDER BY starts_at LIMIT 1`, user.ID).Scan(&scheduledTier, &scheduledAt); err == nil {
		access.Scheduled, access.ScheduledAt = scheduledTier, scheduledAt
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return access, err
	}
	return access, nil
}

// requireLandlordAccess grants the first-time trial, then refuses workspace
// requests from landlords without an active plan. It writes the response and
// returns false when the request must stop.
func (s *Server) requireLandlordAccess(w http.ResponseWriter, r *http.Request, user CurrentUser) bool {
	if err := s.ensureLandlordTrial(r.Context(), user); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start your trial")
		return false
	}
	access, err := s.resolveLandlordAccess(r.Context(), user)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check your plan")
		return false
	}
	if access.State == "locked" {
		writeJSON(w, http.StatusPaymentRequired, map[string]any{"error": "choose a plan to continue using your landlord workspace", "code": "plan_required", "access": access})
		return false
	}
	return true
}

// ownerAccess serves GET /api/v1/owner/access: the plan state for the
// workspace plus the plans a landlord can buy.
func (s *Server) ownerAccess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if err := s.ensureLandlordTrial(r.Context(), user); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start your trial")
		return
	}
	access, err := s.resolveLandlordAccess(r.Context(), user)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check your plan")
		return
	}
	plans := make([]PlanTerms, 0)
	if role := businessRoleFor(user); role != "" {
		if plans, err = s.loadPlans(r.Context(), role, true); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load plans")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"access": access, "plans": plans, "demo_payments": s.demoPaymentsEnabled()})
}
