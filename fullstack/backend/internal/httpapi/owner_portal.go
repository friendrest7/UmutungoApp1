package httpapi

import (
	"context"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ownerPortal serves the landlord portal pages (tenants, payments,
// announcements and rent reminders). Every query is scoped to the session owner.
//
//	GET  /api/v1/owner/portal                       everything the pages need
//	POST /api/v1/owner/portal?action=announcement   save an announcement
//	PUT  /api/v1/owner/portal?action=reminders      save reminder rules
//	POST /api/v1/owner/portal?action=send-reminders prepare eligible reminders now
func (s *Server) ownerPortal(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "property_owner" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "property owner access required")
		return
	}
	if !s.requireLandlordAccess(w, r, user) {
		return
	}
	action := strings.TrimSpace(r.URL.Query().Get("action"))
	switch {
	case r.Method == http.MethodGet:
		s.getOwnerPortal(w, r, user.ID)
	case r.Method == http.MethodPost && action == "announcement":
		s.createOwnerAnnouncement(w, r, user.ID)
	case r.Method == http.MethodPut && action == "reminders":
		s.saveOwnerReminderSettings(w, r, user.ID)
	case r.Method == http.MethodPost && action == "send-reminders":
		items, err := s.prepareOwnerReminders(r.Context(), user.ID, "manual")
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not prepare reminders")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"prepared": len(items), "items": items})
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "unsupported portal action")
	}
}

type ownerChargeRow struct {
	ID, TenantName, TenantPhone, PropertyID, Property, UnitID, Unit string
	AmountDue, Paid                                                 int64
	DueDate                                                         time.Time
}

func kigaliToday() time.Time {
	now := time.Now().In(kigaliLocation())
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func formatRWF(amount int64) string {
	digits := strconv.FormatInt(amount, 10)
	negative := strings.HasPrefix(digits, "-")
	digits = strings.TrimPrefix(digits, "-")
	var out []byte
	for i := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, digits[i])
	}
	if negative {
		return "RWF -" + string(out)
	}
	return "RWF " + string(out)
}

func (s *Server) loadOwnerCharges(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, ownerID string) ([]ownerChargeRow, error) {
	rows, err := q.Query(ctx, `SELECT c.id,c.tenant_name,c.tenant_phone,p.id,p.name,u.id,u.name,c.amount_due,c.due_date,
		COALESCE((SELECT SUM(x.amount) FROM owner_rent_receipts x WHERE x.charge_id=c.id AND x.owner_id=c.owner_id),0)
		FROM owner_rent_charges c
		JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id
		JOIN managed_properties p ON p.id=u.property_id AND p.owner_id=c.owner_id
		WHERE c.owner_id=$1 ORDER BY c.due_date, c.created_at LIMIT 5000`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	charges := make([]ownerChargeRow, 0)
	for rows.Next() {
		var c ownerChargeRow
		if err := rows.Scan(&c.ID, &c.TenantName, &c.TenantPhone, &c.PropertyID, &c.Property, &c.UnitID, &c.Unit, &c.AmountDue, &c.DueDate, &c.Paid); err != nil {
			return nil, err
		}
		charges = append(charges, c)
	}
	return charges, rows.Err()
}

// summarizeTenants groups rent charges into one row per tenant and unit.
// Status priority: overdue, then due today, then upcoming, then paid.
func summarizeTenants(charges []ownerChargeRow, today time.Time) []map[string]any {
	type tenant struct {
		key, name, phone, propertyID, property, unitID, unit string
		rent, overdueBalance, totalBalance                   int64
		oldestOverdue, nextDue                               *time.Time
		dueToday                                             bool
		lastDue                                              time.Time
	}
	byKey := map[string]*tenant{}
	order := make([]string, 0)
	for _, c := range charges {
		key := c.TenantPhone + "|" + c.UnitID
		t, ok := byKey[key]
		if !ok {
			t = &tenant{key: key, phone: c.TenantPhone, propertyID: c.PropertyID, property: c.Property, unitID: c.UnitID, unit: c.Unit}
			byKey[key] = t
			order = append(order, key)
		}
		due := dateOnly(c.DueDate)
		if !due.Before(t.lastDue) {
			t.lastDue, t.name, t.rent = due, c.TenantName, c.AmountDue
		}
		balance := c.AmountDue - c.Paid
		if balance <= 0 {
			continue
		}
		t.totalBalance += balance
		switch {
		case due.Before(today):
			t.overdueBalance += balance
			if t.oldestOverdue == nil || due.Before(*t.oldestOverdue) {
				d := due
				t.oldestOverdue = &d
			}
		case due.Equal(today):
			t.dueToday = true
		default:
			if t.nextDue == nil || due.Before(*t.nextDue) {
				d := due
				t.nextDue = &d
			}
		}
	}
	out := make([]map[string]any, 0, len(order))
	for _, key := range order {
		t := byKey[key]
		status, daysOverdue := "paid", 0
		var nextDue any
		if t.nextDue != nil {
			nextDue = t.nextDue.Format("2006-01-02")
		}
		switch {
		case t.oldestOverdue != nil:
			status = "overdue"
			daysOverdue = int(today.Sub(*t.oldestOverdue).Hours() / 24)
		case t.dueToday:
			status = "due_today"
		case t.nextDue != nil:
			status = "upcoming"
		}
		out = append(out, map[string]any{
			"key": t.key, "name": t.name, "phone": t.phone, "property_id": t.propertyID, "property": t.property,
			"unit_id": t.unitID, "unit": t.unit, "rent": t.rent, "status": status, "days_overdue": daysOverdue,
			"overdue_balance": t.overdueBalance, "balance": t.totalBalance, "next_due_date": nextDue,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return strings.ToLower(out[i]["name"].(string)) < strings.ToLower(out[j]["name"].(string))
	})
	return out
}

func (s *Server) getOwnerPortal(w http.ResponseWriter, r *http.Request, ownerID string) {
	ctx := r.Context()
	charges, err := s.loadOwnerCharges(ctx, s.db, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load tenants")
		return
	}
	today := kigaliToday()
	openCharges := make([]map[string]any, 0)
	for _, c := range charges {
		if balance := c.AmountDue - c.Paid; balance > 0 {
			openCharges = append(openCharges, map[string]any{"id": c.ID, "tenant_name": c.TenantName, "tenant_phone": c.TenantPhone, "property": c.Property, "unit": c.Unit, "amount_due": c.AmountDue, "balance": balance, "due_date": c.DueDate.Format("2006-01-02")})
		}
	}

	payments := make([]map[string]any, 0)
	var paymentsCount, paymentsTotal int64
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*),COALESCE(SUM(amount),0) FROM owner_rent_receipts WHERE owner_id=$1`, ownerID).Scan(&paymentsCount, &paymentsTotal); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load payments")
		return
	}
	paymentRows, err := s.db.Query(ctx, `SELECT x.id,x.amount,x.method,x.reference,x.received_at,c.id,c.tenant_name,c.tenant_phone,c.due_date,p.name,u.name
		FROM owner_rent_receipts x
		JOIN owner_rent_charges c ON c.id=x.charge_id AND c.owner_id=x.owner_id
		JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id
		JOIN managed_properties p ON p.id=u.property_id AND p.owner_id=c.owner_id
		WHERE x.owner_id=$1 ORDER BY x.received_at DESC LIMIT 500`, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load payments")
		return
	}
	for paymentRows.Next() {
		var id, method, reference, chargeID, tenantName, tenantPhone, property, unit string
		var amount int64
		var received, dueDate time.Time
		if err := paymentRows.Scan(&id, &amount, &method, &reference, &received, &chargeID, &tenantName, &tenantPhone, &dueDate, &property, &unit); err != nil {
			paymentRows.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read payments")
			return
		}
		payments = append(payments, map[string]any{"id": id, "amount": amount, "method": method, "reference": reference, "received_at": received, "charge_id": chargeID, "tenant_name": tenantName, "tenant_phone": tenantPhone, "due_date": dueDate.Format("2006-01-02"), "property": property, "unit": unit})
	}
	paymentRows.Close()
	if err := paymentRows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read payments")
		return
	}

	announcements := make([]map[string]any, 0)
	announcementRows, err := s.db.Query(ctx, `SELECT a.id,a.title,a.message,a.recipient_count,a.created_at,COALESCE(p.name,'') FROM owner_announcements a LEFT JOIN managed_properties p ON p.id=a.property_id AND p.owner_id=a.owner_id WHERE a.owner_id=$1 ORDER BY a.created_at DESC LIMIT 100`, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load announcements")
		return
	}
	for announcementRows.Next() {
		var id, title, message, property string
		var recipients int
		var created time.Time
		if err := announcementRows.Scan(&id, &title, &message, &recipients, &created, &property); err != nil {
			announcementRows.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read announcements")
			return
		}
		announcements = append(announcements, map[string]any{"id": id, "title": title, "message": message, "recipient_count": recipients, "created_at": created, "property": property})
	}
	announcementRows.Close()

	settings, saved, err := s.ownerReminderSettings(ctx, s.db, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load reminder settings")
		return
	}
	settingsJSON := settings.toJSON()
	settingsJSON["saved"] = saved
	recent := make([]map[string]any, 0)
	reminderRows, err := s.db.Query(ctx, `SELECT m.id,m.kind,m.message,m.trigger,m.created_at,c.tenant_name,c.tenant_phone FROM owner_rent_reminders m JOIN owner_rent_charges c ON c.id=m.charge_id AND c.owner_id=m.owner_id WHERE m.owner_id=$1 ORDER BY m.created_at DESC LIMIT 20`, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load reminders")
		return
	}
	for reminderRows.Next() {
		var id, kind, message, trigger, name, phone string
		var created time.Time
		if err := reminderRows.Scan(&id, &kind, &message, &trigger, &created, &name, &phone); err != nil {
			reminderRows.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read reminders")
			return
		}
		recent = append(recent, map[string]any{"id": id, "kind": kind, "message": message, "trigger": trigger, "created_at": created, "tenant_name": name, "tenant_phone": phone})
	}
	reminderRows.Close()

	writeJSON(w, http.StatusOK, map[string]any{
		"today":            today.Format("2006-01-02"),
		"tenants":          summarizeTenants(charges, today),
		"open_charges":     openCharges,
		"payments":         payments,
		"payments_summary": map[string]any{"count": paymentsCount, "total": paymentsTotal},
		"announcements":    announcements,
		"reminders":        map[string]any{"settings": settingsJSON, "recent": recent},
	})
}

func (s *Server) createOwnerAnnouncement(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		PropertyID string `json:"property_id"`
		Title      string `json:"title"`
		Message    string `json:"message"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.PropertyID, in.Title, in.Message = strings.TrimSpace(in.PropertyID), strings.TrimSpace(in.Title), strings.TrimSpace(in.Message)
	if in.Title == "" || len([]rune(in.Title)) > 120 || in.Message == "" || len([]rune(in.Message)) > 2000 {
		errorJSON(w, http.StatusBadRequest, "a title (up to 120 characters) and a message (up to 2000 characters) are required")
		return
	}
	var id string
	var recipients int
	var created time.Time
	// Recipients are the distinct tenants with a rent record in scope.
	err := s.db.QueryRow(r.Context(), `INSERT INTO owner_announcements(owner_id,property_id,title,message,recipient_count)
		SELECT $1, NULLIF($2,'')::uuid, $3, $4,
		  (SELECT COUNT(DISTINCT c.tenant_phone) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id
		   WHERE c.owner_id=$1 AND (NULLIF($2,'')::uuid IS NULL OR u.property_id=NULLIF($2,'')::uuid))
		WHERE $2='' OR EXISTS(SELECT 1 FROM managed_properties WHERE id=NULLIF($2,'')::uuid AND owner_id=$1)
		RETURNING id, recipient_count, created_at`, ownerID, in.PropertyID, in.Title, in.Message).Scan(&id, &recipients, &created)
	if err == pgx.ErrNoRows {
		errorJSON(w, http.StatusBadRequest, "property was not found in this owner's portfolio")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save announcement")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "recipient_count": recipients, "created_at": created})
}

type reminderSettings struct {
	AutoEnabled                                      bool
	DaysBefore, OverdueInterval                      int
	SendOnDue                                        bool
	UpcomingMessage, DueTodayMessage, OverdueMessage string
}

func (v reminderSettings) toJSON() map[string]any {
	return map[string]any{"auto_enabled": v.AutoEnabled, "days_before": v.DaysBefore, "overdue_interval": v.OverdueInterval, "send_on_due": v.SendOnDue, "upcoming_message": v.UpcomingMessage, "due_today_message": v.DueTodayMessage, "overdue_message": v.OverdueMessage}
}

var defaultReminderSettings = reminderSettings{
	AutoEnabled: true, DaysBefore: 3, OverdueInterval: 3, SendOnDue: true,
	UpcomingMessage: "Hello {tenant}, your rent of {amount} is due on {due_date}.",
	DueTodayMessage: "Hello {tenant}, your rent of {amount} is due today ({due_date}).",
	OverdueMessage:  "Hello {tenant}, your rent of {amount} was due on {due_date} and is now overdue.",
}

func (s *Server) ownerReminderSettings(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, ownerID string) (reminderSettings, bool, error) {
	v := reminderSettings{}
	err := q.QueryRow(ctx, `SELECT auto_enabled,days_before,overdue_interval,send_on_due,upcoming_message,due_today_message,overdue_message FROM owner_reminder_settings WHERE owner_id=$1`, ownerID).
		Scan(&v.AutoEnabled, &v.DaysBefore, &v.OverdueInterval, &v.SendOnDue, &v.UpcomingMessage, &v.DueTodayMessage, &v.OverdueMessage)
	if err == pgx.ErrNoRows {
		return defaultReminderSettings, false, nil
	}
	return v, err == nil, err
}

func (s *Server) saveOwnerReminderSettings(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		AutoEnabled     bool   `json:"auto_enabled"`
		DaysBefore      int    `json:"days_before"`
		OverdueInterval int    `json:"overdue_interval"`
		SendOnDue       bool   `json:"send_on_due"`
		UpcomingMessage string `json:"upcoming_message"`
		DueTodayMessage string `json:"due_today_message"`
		OverdueMessage  string `json:"overdue_message"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	messages := []*string{&in.UpcomingMessage, &in.DueTodayMessage, &in.OverdueMessage}
	for _, message := range messages {
		*message = strings.TrimSpace(*message)
		if *message == "" || len([]rune(*message)) > 500 {
			errorJSON(w, http.StatusBadRequest, "each reminder message must be between 1 and 500 characters")
			return
		}
	}
	if in.DaysBefore < 0 || in.DaysBefore > 30 || in.OverdueInterval < 1 || in.OverdueInterval > 30 {
		errorJSON(w, http.StatusBadRequest, "days before due must be 0-30 and the overdue interval 1-30 days")
		return
	}
	_, err := s.db.Exec(r.Context(), `INSERT INTO owner_reminder_settings(owner_id,auto_enabled,days_before,overdue_interval,send_on_due,upcoming_message,due_today_message,overdue_message,updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
		ON CONFLICT(owner_id) DO UPDATE SET auto_enabled=EXCLUDED.auto_enabled,days_before=EXCLUDED.days_before,overdue_interval=EXCLUDED.overdue_interval,send_on_due=EXCLUDED.send_on_due,upcoming_message=EXCLUDED.upcoming_message,due_today_message=EXCLUDED.due_today_message,overdue_message=EXCLUDED.overdue_message,updated_at=NOW()`,
		ownerID, in.AutoEnabled, in.DaysBefore, in.OverdueInterval, in.SendOnDue, in.UpcomingMessage, in.DueTodayMessage, in.OverdueMessage)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save reminder settings")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "saved"})
}

func renderReminder(template string, c ownerChargeRow, balance int64) string {
	return strings.NewReplacer(
		"{tenant}", c.TenantName,
		"{amount}", formatRWF(balance),
		"{due_date}", c.DueDate.Format("2 Jan 2006"),
		"{property}", c.Property,
		"{unit}", c.Unit,
	).Replace(template)
}

// prepareOwnerReminders records every reminder that is due under the owner's
// rules and returns them. It never sends SMS or collects money; the landlord
// shares the prepared messages (for example through WhatsApp links).
// Upcoming and due-today reminders are prepared once per charge; overdue
// reminders repeat every overdue_interval days.
func (s *Server) prepareOwnerReminders(ctx context.Context, ownerID, trigger string) ([]map[string]any, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// Serialize manual and automatic runs for the same owner.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('owner-reminders:' || $1::text))`, ownerID); err != nil {
		return nil, err
	}
	settings, _, err := s.ownerReminderSettings(ctx, tx, ownerID)
	if err != nil {
		return nil, err
	}
	charges, err := s.loadOwnerCharges(ctx, tx, ownerID)
	if err != nil {
		return nil, err
	}
	today := kigaliToday()
	items := make([]map[string]any, 0)
	for _, c := range charges {
		balance := c.AmountDue - c.Paid
		if balance <= 0 {
			continue
		}
		daysUntil := int(dateOnly(c.DueDate).Sub(today).Hours() / 24)
		kind, template := "", ""
		switch {
		case daysUntil > 0 && settings.DaysBefore > 0 && daysUntil <= settings.DaysBefore:
			kind, template = "upcoming", settings.UpcomingMessage
		case daysUntil == 0 && settings.SendOnDue:
			kind, template = "due_today", settings.DueTodayMessage
		case daysUntil < 0:
			kind, template = "overdue", settings.OverdueMessage
		default:
			continue
		}
		var already bool
		if kind == "overdue" {
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM owner_rent_reminders WHERE charge_id=$1 AND owner_id=$2 AND kind='overdue' AND created_at > NOW() - make_interval(days => $3))`, c.ID, ownerID, settings.OverdueInterval).Scan(&already)
		} else {
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM owner_rent_reminders WHERE charge_id=$1 AND owner_id=$2 AND kind=$3)`, c.ID, ownerID, kind).Scan(&already)
		}
		if err != nil {
			return nil, err
		}
		if already {
			continue
		}
		message := renderReminder(template, c, balance)
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO owner_rent_reminders(owner_id,charge_id,kind,message,trigger) VALUES($1,$2,$3,$4,$5) RETURNING id`, ownerID, c.ID, kind, message, trigger).Scan(&id); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{"id": id, "charge_id": c.ID, "kind": kind, "message": message, "tenant_name": c.TenantName, "tenant_phone": c.TenantPhone, "property": c.Property, "unit": c.Unit})
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

// runAutomaticRentReminders prepares reminders for owners who saved reminder
// rules with automatic reminders switched on.
func (s *Server) runAutomaticRentReminders(ctx context.Context) error {
	rows, err := s.db.Query(ctx, `SELECT owner_id FROM owner_reminder_settings WHERE auto_enabled`)
	if err != nil {
		return err
	}
	owners := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		owners = append(owners, id)
	}
	rows.Close()
	for _, owner := range owners {
		if _, err := s.prepareOwnerReminders(ctx, owner, "automatic"); err != nil {
			log.Printf("automatic rent reminders for owner %s: %v", owner, err)
		}
	}
	return rows.Err()
}
