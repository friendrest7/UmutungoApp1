package httpapi

import (
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ownerWorkspace keeps private portfolio records separate from public listing
// records. Every statement is scoped to the authenticated session owner.
func (s *Server) ownerWorkspace(w http.ResponseWriter, r *http.Request) {
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
	if r.Method == http.MethodGet {
		s.getOwnerWorkspace(w, r, user.ID)
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or POST")
		return
	}
	if strings.Trim(r.URL.Query().Get("action"), " ") == "payment" {
		s.recordOwnerPayment(w, r, user.ID)
		return
	}
	if strings.Trim(r.URL.Query().Get("action"), " ") == "charge" {
		s.createOwnerCharge(w, r, user.ID)
		return
	}
	if strings.Trim(r.URL.Query().Get("action"), " ") == "unit" {
		s.createManagedUnit(w, r, user.ID)
		return
	}
	if strings.Trim(r.URL.Query().Get("action"), " ") == "onboarding" {
		s.updateOwnerOnboarding(w, r, user.ID)
		return
	}
	if strings.Trim(r.URL.Query().Get("action"), " ") == "maintenance" {
		s.createOwnerMaintenance(w, r, user.ID)
		return
	}
	s.createManagedProperty(w, r, user.ID)
}

func (s *Server) ownerWorkspaceItem(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "property_owner" {
		errorJSON(w, http.StatusForbidden, "property owner access required")
		return
	}
	if r.Method != http.MethodPatch {
		errorJSON(w, http.StatusMethodNotAllowed, "use PATCH")
		return
	}
	if !s.requireLandlordAccess(w, r, user) {
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/owner/workspace/"), "/")
	if id == "" || strings.Contains(id, "/") {
		errorJSON(w, http.StatusNotFound, "maintenance request not found")
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Status = strings.ToLower(strings.TrimSpace(in.Status))
	if !containsString([]string{"submitted", "in_progress", "resolved"}, in.Status) {
		errorJSON(w, http.StatusBadRequest, "status must be submitted, in_progress, or resolved")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update repair status")
		return
	}
	defer tx.Rollback(r.Context())
	var previous string
	err = tx.QueryRow(r.Context(), `SELECT status FROM owner_maintenance_requests WHERE id=$1 AND owner_id=$2 FOR UPDATE`, id, user.ID).Scan(&previous)
	if err == pgx.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "maintenance request not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read repair status")
		return
	}
	if previous != in.Status {
		if _, err = tx.Exec(r.Context(), `UPDATE owner_maintenance_requests SET status=$3,updated_at=NOW() WHERE id=$1 AND owner_id=$2`, id, user.ID, in.Status); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not update repair status")
			return
		}
		if _, err = tx.Exec(r.Context(), `INSERT INTO owner_maintenance_events(request_id,owner_id,previous_status,next_status) VALUES($1,$2,$3,$4)`, id, user.ID, previous, in.Status); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save repair history")
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish repair update")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": in.Status})
}

func (s *Server) getOwnerWorkspace(w http.ResponseWriter, r *http.Request, ownerID string) {
	if _, err := s.db.Exec(r.Context(), `INSERT INTO owner_onboarding(owner_id) VALUES($1) ON CONFLICT(owner_id) DO NOTHING`, ownerID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load workspace setup")
		return
	}
	var onboardingStep int
	var onboardingCompleted *time.Time
	if err := s.db.QueryRow(r.Context(), `SELECT step,completed_at FROM owner_onboarding WHERE owner_id=$1`, ownerID).Scan(&onboardingStep, &onboardingCompleted); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load workspace setup")
		return
	}
	month := time.Now().In(kigaliLocation()).Format("2006-01")
	if value := r.URL.Query().Get("month"); len(value) == 7 && value[4] == '-' {
		month = value
	}
	propertyID := strings.TrimSpace(r.URL.Query().Get("property_id"))
	var expected, collected, occupied, total int64
	var activeTenants, overdue int
	err := s.db.QueryRow(r.Context(), `
		SELECT COALESCE((SELECT SUM(c.amount_due) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE c.owner_id=$1 AND to_char(c.due_date,'YYYY-MM')=$2 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid)),0),
		COALESCE((SELECT SUM(p.amount) FROM owner_rent_receipts p JOIN owner_rent_charges c ON c.id=p.charge_id AND c.owner_id=p.owner_id JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE p.owner_id=$1 AND to_char(c.due_date,'YYYY-MM')=$2 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid)),0),
		(SELECT COUNT(DISTINCT c.unit_id) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE c.owner_id=$1 AND to_char(c.due_date,'YYYY-MM')=$2 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid)),
		(SELECT COUNT(*) FROM managed_units u WHERE u.owner_id=$1 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid)),
		(SELECT COUNT(DISTINCT c.tenant_phone) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE c.owner_id=$1 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid)),
		(SELECT COUNT(*) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE c.owner_id=$1 AND (NULLIF($3,'')::uuid IS NULL OR u.property_id=NULLIF($3,'')::uuid) AND c.due_date < (NOW() AT TIME ZONE 'Africa/Kigali')::date AND c.amount_due > COALESCE((SELECT SUM(p.amount) FROM owner_rent_receipts p WHERE p.charge_id=c.id AND p.owner_id=c.owner_id),0))`, ownerID, month, propertyID).
		Scan(&expected, &collected, &occupied, &total, &activeTenants, &overdue)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load owner summary")
		return
	}
	properties, err := s.db.Query(r.Context(), `SELECT p.id,p.name,p.province,p.district,p.sector,p.cell,p.village,p.created_at,
		(SELECT COALESCE(json_agg(json_build_object('id',u.id,'name',u.name,'monthly_rent',u.monthly_rent) ORDER BY u.created_at),'[]'::json) FROM managed_units u WHERE u.property_id=p.id AND u.owner_id=p.owner_id),
		(SELECT COUNT(*) FROM managed_units u WHERE u.property_id=p.id AND u.owner_id=p.owner_id),
		(SELECT COUNT(DISTINCT c.unit_id) FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id WHERE c.owner_id=p.owner_id AND u.property_id=p.id AND to_char(c.due_date,'YYYY-MM')=$2),
		COALESCE(l.id::text,''),COALESCE(l.title,''),COALESCE(l.status,''),COALESCE(l.is_featured,FALSE)
		FROM managed_properties p LEFT JOIN listings l ON l.id=p.listing_id AND l.owner_id=p.owner_id AND l.deleted_at IS NULL
		WHERE p.owner_id=$1 ORDER BY p.created_at DESC LIMIT 50`, ownerID, month)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load properties")
		return
	}
	items := make([]map[string]any, 0)
	for properties.Next() {
		var id, name, province, district, sector, cell, village string
		var created time.Time
		var unitsJSON []byte
		var unitCount, occupiedCount int
		var listingID, listingTitle, listingStatus string
		var listingFeatured bool
		if err := properties.Scan(&id, &name, &province, &district, &sector, &cell, &village, &created, &unitsJSON, &unitCount, &occupiedCount, &listingID, &listingTitle, &listingStatus, &listingFeatured); err != nil {
			properties.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read properties")
			return
		}
		items = append(items, map[string]any{"id": id, "name": name, "province": province, "district": district, "sector": sector, "cell": cell, "village": village, "created_at": created, "unit_count": unitCount, "units": rawJSON(unitsJSON), "occupied_units": occupiedCount, "listing": propertyListing(listingID, listingTitle, listingStatus, listingFeatured)})
	}
	properties.Close()
	if err := properties.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read properties")
		return
	}
	charges, err := s.db.Query(r.Context(), `SELECT c.id,c.tenant_name,c.tenant_phone,p.name,u.name,c.amount_due,c.due_date,
		COALESCE((SELECT SUM(x.amount) FROM owner_rent_receipts x WHERE x.charge_id=c.id AND x.owner_id=c.owner_id),0),
		COALESCE((SELECT string_agg(DISTINCT x.method, ',') FROM owner_rent_receipts x WHERE x.charge_id=c.id AND x.owner_id=c.owner_id),'')
		FROM owner_rent_charges c JOIN managed_units u ON u.id=c.unit_id AND u.owner_id=c.owner_id JOIN managed_properties p ON p.id=u.property_id AND p.owner_id=c.owner_id
		WHERE c.owner_id=$1 AND to_char(c.due_date,'YYYY-MM')=$2 AND (NULLIF($3,'')::uuid IS NULL OR p.id=NULLIF($3,'')::uuid) ORDER BY c.due_date LIMIT 100`, ownerID, month, propertyID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load rent records")
		return
	}
	rentItems := make([]map[string]any, 0)
	for charges.Next() {
		var id, name, phone, property, unit, method string
		var due, paid int64
		var dueDate time.Time
		if err := charges.Scan(&id, &name, &phone, &property, &unit, &due, &dueDate, &paid, &method); err != nil {
			charges.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read rent records")
			return
		}
		status := "upcoming"
		localToday := time.Now().In(kigaliLocation()).Format("2006-01-02")
		date := dueDate.Format("2006-01-02")
		if paid >= due {
			status = "paid"
		} else if date < localToday {
			status = "overdue"
		} else if date == localToday {
			status = "due_today"
		}
		if paid > 0 && paid < due {
			status = "partial_" + status
		}
		rentItems = append(rentItems, map[string]any{"id": id, "tenant_name": name, "tenant_phone": phone, "property": property, "unit": unit, "amount_due": due, "amount_paid": paid, "balance": due - paid, "due_date": date, "method": method, "status": status})
	}
	charges.Close()
	if err := charges.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read rent records")
		return
	}
	maintenanceRows, err := s.db.Query(r.Context(), `SELECT m.id,m.description,m.priority,m.status,m.created_at,COALESCE(p.name,''),COALESCE(u.name,'') FROM owner_maintenance_requests m LEFT JOIN managed_units u ON u.id=m.unit_id AND u.owner_id=m.owner_id LEFT JOIN managed_properties p ON p.id=u.property_id AND p.owner_id=u.owner_id WHERE m.owner_id=$1 ORDER BY m.created_at DESC LIMIT 20`, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load repairs")
		return
	}
	maintenance := make([]map[string]any, 0)
	for maintenanceRows.Next() {
		var id, description, priority, status, property, unit string
		var created time.Time
		if err := maintenanceRows.Scan(&id, &description, &priority, &status, &created, &property, &unit); err != nil {
			maintenanceRows.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read repairs")
			return
		}
		maintenance = append(maintenance, map[string]any{"id": id, "description": description, "priority": priority, "status": status, "created_at": created, "property": property, "unit": unit})
	}
	maintenanceRows.Close()
	applicationRows, err := s.db.Query(r.Context(), `SELECT a.id,a.listing_id,l.title,u.name,COALESCE(u.phone,''),a.status,a.message,a.created_at FROM rental_applications a JOIN listings l ON l.id=a.listing_id JOIN users u ON u.id=a.applicant_id WHERE l.owner_id=$1 ORDER BY a.created_at DESC LIMIT 100`, ownerID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load rental enquiries")
		return
	}
	applications := make([]map[string]any, 0)
	for applicationRows.Next() {
		var id, listingID, title, name, phone, status, message string
		var created time.Time
		if err := applicationRows.Scan(&id, &listingID, &title, &name, &phone, &status, &message, &created); err != nil {
			applicationRows.Close()
			errorJSON(w, http.StatusInternalServerError, "could not read rental enquiries")
			return
		}
		applications = append(applications, map[string]any{"id": id, "listing_id": listingID, "listing_title": title, "applicant_name": name, "phone": phone, "status": status, "message": message, "created_at": created})
	}
	applicationRows.Close()
	if err := applicationRows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read rental enquiries")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"month": month, "summary": map[string]any{"expected": expected, "collected": collected, "balance": expected - collected, "occupied_units": occupied, "total_units": total, "active_tenants": activeTenants, "overdue_count": overdue}, "properties": items, "rent": rentItems, "maintenance": maintenance, "applications": applications, "onboarding": map[string]any{"step": onboardingStep, "completed": onboardingCompleted != nil}, "billing": map[string]any{"configured": false, "message": "Landlord subscription billing is not configured."}})
}

func (s *Server) updateOwnerOnboarding(w http.ResponseWriter, r *http.Request, ownerID string) {
	var input struct {
		Step     int  `json:"step"`
		Complete bool `json:"complete"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.Step < 1 || input.Step > 5 {
		errorJSON(w, http.StatusBadRequest, "step must be between 1 and 5")
		return
	}
	var err error
	if input.Complete {
		_, err = s.db.Exec(r.Context(), `INSERT INTO owner_onboarding(owner_id,step,completed_at,updated_at) VALUES($1,5,NOW(),NOW()) ON CONFLICT(owner_id) DO UPDATE SET step=5,completed_at=NOW(),updated_at=NOW()`, ownerID)
	} else {
		_, err = s.db.Exec(r.Context(), `INSERT INTO owner_onboarding(owner_id,step,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(owner_id) DO UPDATE SET step=EXCLUDED.step,updated_at=NOW() WHERE owner_onboarding.completed_at IS NULL`, ownerID, input.Step)
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save workspace setup progress")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"step": input.Step, "completed": input.Complete})
}

func kigaliLocation() *time.Location {
	location, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		return time.UTC
	}
	return location
}

func (s *Server) createManagedProperty(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		Name        string `json:"name"`
		Province    string `json:"province"`
		District    string `json:"district"`
		Sector      string `json:"sector"`
		Cell        string `json:"cell"`
		Village     string `json:"village"`
		Unit        string `json:"unit"`
		MonthlyRent int64  `json:"monthly_rent"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Province = strings.TrimSpace(in.Province)
	in.District = strings.TrimSpace(in.District)
	in.Sector = strings.TrimSpace(in.Sector)
	in.Unit = strings.TrimSpace(in.Unit)
	if in.Name == "" || in.Province == "" || in.District == "" || in.Sector == "" || (in.Unit != "" && in.MonthlyRent < 0) {
		errorJSON(w, http.StatusBadRequest, "name, province, district and sector are required; rent cannot be negative")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start property save")
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO managed_properties(owner_id,name,province,district,sector,cell,village) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, ownerID, in.Name, in.Province, in.District, in.Sector, strings.TrimSpace(in.Cell), strings.TrimSpace(in.Village)).Scan(&id)
	if err == nil && in.Unit != "" {
		_, err = tx.Exec(r.Context(), `INSERT INTO managed_units(property_id,owner_id,name,monthly_rent) VALUES($1,$2,$3,$4)`, id, ownerID, in.Unit, in.MonthlyRent)
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO owner_onboarding(owner_id,step) VALUES($1,2) ON CONFLICT(owner_id) DO UPDATE SET step=GREATEST(owner_onboarding.step,2),updated_at=NOW() WHERE owner_onboarding.completed_at IS NULL`, ownerID)
	}
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not save property and unit")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish property save")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "name": in.Name, "province": in.Province, "district": in.District, "sector": in.Sector, "units": map[bool]int{true: 1, false: 0}[in.Unit != ""]})
}

func (s *Server) createManagedUnit(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		PropertyID  string `json:"property_id"`
		Name        string `json:"name"`
		MonthlyRent int64  `json:"monthly_rent"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.PropertyID == "" || in.Name == "" || len([]rune(in.Name)) > 80 || in.MonthlyRent < 0 {
		errorJSON(w, http.StatusBadRequest, "property, unit name and a non-negative monthly rent are required")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO managed_units(property_id,owner_id,name,monthly_rent) SELECT p.id,p.owner_id,$3,$4 FROM managed_properties p WHERE p.id=$1 AND p.owner_id=$2 RETURNING id`, in.PropertyID, ownerID, in.Name, in.MonthlyRent).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "property was not found in this owner's portfolio")
		return
	}
	_, _ = s.db.Exec(r.Context(), `UPDATE owner_onboarding SET step=GREATEST(step,2),updated_at=NOW() WHERE owner_id=$1 AND completed_at IS NULL`, ownerID)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "property_id": in.PropertyID, "name": in.Name, "monthly_rent": in.MonthlyRent})
}

func (s *Server) recordOwnerPayment(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		ChargeID       string `json:"charge_id"`
		Amount         int64  `json:"amount"`
		Method         string `json:"method"`
		Reference      string `json:"reference"`
		IdempotencyKey string `json:"idempotency_key"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Method = strings.ToLower(strings.TrimSpace(in.Method))
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if in.Amount <= 0 || in.ChargeID == "" || in.IdempotencyKey == "" || len(in.IdempotencyKey) > 100 || !containsString([]string{"cash", "bank_transfer", "mtn_momo", "airtel_money"}, in.Method) {
		errorJSON(w, http.StatusBadRequest, "charge, positive amount, idempotency key and supported method are required")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start receipt")
		return
	}
	defer tx.Rollback(r.Context())
	var previous string
	err = tx.QueryRow(r.Context(), `SELECT id FROM owner_rent_receipts WHERE owner_id=$1 AND idempotency_key=$2`, ownerID, in.IdempotencyKey).Scan(&previous)
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]any{"id": previous, "status": "recorded", "duplicate": true})
		return
	}
	if err != pgx.ErrNoRows {
		errorJSON(w, http.StatusInternalServerError, "could not check duplicate submission")
		return
	}
	var due, paid int64
	err = tx.QueryRow(r.Context(), `SELECT amount_due FROM owner_rent_charges WHERE id=$1 AND owner_id=$2 FOR UPDATE`, in.ChargeID, ownerID).Scan(&due)
	if err == pgx.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "rent charge not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check rent balance")
		return
	}
	// Recheck idempotency and the allocation after taking the charge lock. This
	// serializes competing partial payments and prevents concurrent overpayment.
	err = tx.QueryRow(r.Context(), `SELECT id FROM owner_rent_receipts WHERE owner_id=$1 AND idempotency_key=$2`, ownerID, in.IdempotencyKey).Scan(&previous)
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]any{"id": previous, "status": "recorded", "duplicate": true})
		return
	}
	if err != pgx.ErrNoRows {
		errorJSON(w, http.StatusInternalServerError, "could not check duplicate submission")
		return
	}
	if err = tx.QueryRow(r.Context(), `SELECT COALESCE(SUM(amount),0) FROM owner_rent_receipts WHERE charge_id=$1 AND owner_id=$2`, in.ChargeID, ownerID).Scan(&paid); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check rent balance")
		return
	}
	if in.Amount > due-paid {
		errorJSON(w, http.StatusConflict, "payment exceeds the outstanding balance")
		return
	}
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO owner_rent_receipts(owner_id,charge_id,amount,method,reference,idempotency_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, ownerID, in.ChargeID, in.Amount, in.Method, strings.TrimSpace(in.Reference), in.IdempotencyKey).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not record payment")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish payment record")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "recorded", "collection": "manual_record_only", "amount": in.Amount, "currency": "RWF"})
}

func (s *Server) createOwnerMaintenance(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		UnitID      string `json:"unit_id"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Description = strings.TrimSpace(in.Description)
	in.Priority = strings.ToLower(strings.TrimSpace(in.Priority))
	if in.Priority == "" {
		in.Priority = "normal"
	}
	if in.Description == "" || !containsString([]string{"low", "normal", "urgent"}, in.Priority) {
		errorJSON(w, http.StatusBadRequest, "description and valid priority are required")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO owner_maintenance_requests(owner_id,unit_id,description,priority) SELECT $1,NULLIF($2,'')::uuid,$3,$4 WHERE $2='' OR EXISTS(SELECT 1 FROM managed_units WHERE id=$2 AND owner_id=$1) RETURNING id`, ownerID, in.UnitID, in.Description, in.Priority).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "unit was not found in this owner's portfolio")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "submitted"})
}

func (s *Server) createOwnerCharge(w http.ResponseWriter, r *http.Request, ownerID string) {
	var in struct {
		UnitID      string `json:"unit_id"`
		TenantName  string `json:"tenant_name"`
		TenantPhone string `json:"tenant_phone"`
		Amount      int64  `json:"amount_due"`
		DueDate     string `json:"due_date"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.TenantName = strings.TrimSpace(in.TenantName)
	phone, phoneErr := normalizeRwandaPhone(in.TenantPhone)
	dueDate, dateErr := time.Parse("2006-01-02", in.DueDate)
	if in.UnitID == "" || in.TenantName == "" || len(in.TenantName) > 120 || phoneErr != nil || in.Amount <= 0 || dateErr != nil {
		errorJSON(w, http.StatusBadRequest, "unit, tenant name, valid Rwanda phone, positive amount and due date are required")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start rent charge")
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO owner_rent_charges(owner_id,unit_id,tenant_name,tenant_phone,amount_due,due_date) SELECT $1,u.id,$3,$4,$5,$6 FROM managed_units u WHERE u.id=$2 AND u.owner_id=$1 RETURNING id`, ownerID, in.UnitID, in.TenantName, phone, in.Amount, dueDate).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "unit was not found in this owner's portfolio")
		return
	}
	if _, err = tx.Exec(r.Context(), `INSERT INTO owner_onboarding(owner_id,step,completed_at,updated_at) VALUES($1,5,NOW(),NOW()) ON CONFLICT(owner_id) DO UPDATE SET step=5,completed_at=NOW(),updated_at=NOW() WHERE owner_onboarding.completed_at IS NULL`, ownerID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save onboarding progress")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish rent charge")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "created"})
}
