package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/umutungo/umutungo/backend/internal/config"
)

type Server struct {
	db  *pgxpool.Pool
	cfg config.Config
}

type CurrentUser struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email,omitempty"`
	Phone  string `json:"phone"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

type profileResponse struct {
	Bio      string `json:"bio"`
	PhotoURL string `json:"photo_url"`
	Language string `json:"language"`
}

func New(db *pgxpool.Pool, cfg config.Config) *Server {
	return &Server{db: db, cfg: cfg}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.root)
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc("/readyz", s.ready)
	mux.HandleFunc("/api/v1/auth/register", s.register)
	mux.HandleFunc("/api/v1/auth/request-otp", s.requestOTP)
	mux.HandleFunc("/api/v1/auth/verify-otp", s.verifyOTP)
	mux.HandleFunc("/api/v1/auth/google", s.googleAuth)
	mux.HandleFunc("/api/v1/me", s.me)
	mux.HandleFunc("/api/v1/directory", s.directory)
	mux.HandleFunc("/api/v1/listings", s.listings)
	mux.HandleFunc("/api/v1/listings/", s.listingRoute)
	mux.HandleFunc("/uploads/", s.mediaFile)
	mux.HandleFunc("/api/v1/applications", s.applications)
	mux.HandleFunc("/api/v1/applications/", s.applicationRoute)
	mux.HandleFunc("/api/v1/payments", s.payments)
	mux.HandleFunc("/api/v1/payments/", s.paymentRoute)
	mux.HandleFunc("/api/v1/messages", s.messages)
	mux.HandleFunc("/api/v1/reviews", s.reviews)
	mux.HandleFunc("/api/v1/bookings", s.bookings)
	mux.HandleFunc("/api/v1/reports", s.reports)
	mux.HandleFunc("/api/v1/admin/reports", s.adminReports)
	mux.HandleFunc("/api/v1/admin/reports/", s.adminReportRoute)
	mux.HandleFunc("/api/v1/admin/locations", s.adminLocations)
	mux.HandleFunc("/api/v1/notifications", s.notifications)
	mux.HandleFunc("/api/v1/favorites", s.favorites)
	mux.HandleFunc("/api/v1/favorites/", s.favoriteRoute)
	mux.HandleFunc("/api/v1/owner/dashboard", s.ownerDashboard)
	mux.HandleFunc("/api/v1/owner/listings", s.ownerListings)
	mux.HandleFunc("/api/v1/tenant/dashboard", s.tenantDashboard)
	mux.HandleFunc("/api/v1/maintenance", s.maintenance)
	return s.middleware(mux)
}

func (s *Server) root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		errorJSON(w, http.StatusNotFound, "route not found")
		return
	}
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"service": "umutungo-api",
		"status":  "ok",
		"health":  "/health",
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := s.db.Ping(r.Context()); err != nil {
		errorJSON(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var input struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Phone string `json:"phone"`
		Role  string `json:"role"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Phone) == "" {
		errorJSON(w, http.StatusBadRequest, "name and phone are required")
		return
	}
	input.Role = strings.ToLower(strings.TrimSpace(input.Role))
	if input.Role == "" {
		input.Role = "client"
	}
	if !validRole(input.Role) || input.Role == "admin" {
		errorJSON(w, http.StatusBadRequest, "invalid registration role")
		return
	}

	var user CurrentUser
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO users(name, email, phone, role) VALUES($1, NULLIF($2, ''), $3, $4)
		RETURNING id, name, COALESCE(email, ''), phone, role, status`,
		strings.TrimSpace(input.Name), strings.TrimSpace(input.Email), strings.TrimSpace(input.Phone), input.Role).
		Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.Status)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			errorJSON(w, http.StatusConflict, "a user with this phone already exists")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not create user")
		return
	}
	_, _ = s.db.Exec(r.Context(), `INSERT INTO profiles(user_id) VALUES($1)`, user.ID)
	if input.Role == "komisiyoneri" || input.Role == "property_owner" {
		_, _ = s.db.Exec(r.Context(), `INSERT INTO business_profiles(user_id) VALUES($1)`, user.ID)
	}
	code := "111111"
	if s.cfg.AppEnv != "development" {
		code = randomDigits(6)
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO otp_challenges(phone, code_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '10 minutes')`, input.Phone, hash(code)); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create OTP challenge")
		return
	}
	response := map[string]any{"user": user, "message": "registration created; verify phone with OTP"}
	if s.cfg.AppEnv == "development" {
		response["development_code"] = code
	}
	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) requestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var input struct {
		Phone string `json:"phone"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Phone) == "" {
		errorJSON(w, http.StatusBadRequest, "phone is required")
		return
	}
	var code string
	if s.cfg.AppEnv == "development" {
		code = "111111"
	} else {
		code = randomDigits(6)
	}
	_, err := s.db.Exec(r.Context(), `INSERT INTO otp_challenges(phone, code_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '10 minutes')`, input.Phone, hash(code))
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create OTP challenge")
		return
	}
	response := map[string]any{"message": "OTP sent"}
	if s.cfg.AppEnv == "development" {
		response["development_code"] = code
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) verifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var input struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &input) || input.Phone == "" || input.Code == "" {
		errorJSON(w, http.StatusBadRequest, "phone and code are required")
		return
	}
	var challengeID string
	var codeHash string
	var userID string
	err := s.db.QueryRow(r.Context(), `
		SELECT c.id, c.code_hash, u.id
		FROM otp_challenges c JOIN users u ON u.phone = c.phone
		WHERE c.phone=$1 AND c.used_at IS NULL AND c.expires_at > NOW()
		ORDER BY c.created_at DESC LIMIT 1`, input.Phone).Scan(&challengeID, &codeHash, &userID)
	if err != nil || hash(input.Code) != codeHash {
		errorJSON(w, http.StatusUnauthorized, "invalid or expired OTP")
		return
	}
	if _, err := s.db.Exec(r.Context(), `UPDATE otp_challenges SET used_at=NOW() WHERE id=$1`, challengeID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not verify OTP")
		return
	}
	token, err := s.createSession(r, userID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create session")
		return
	}
	user, _ := s.userByID(r, userID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "access_token": token})
}

func (s *Server) googleAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	allowedClientIDs := configuredGoogleClientIDs(s.cfg.GoogleClientIDs)
	if len(allowedClientIDs) == 0 {
		errorJSON(w, http.StatusServiceUnavailable, "Google sign-in is not configured")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	var input struct {
		AccessToken string `json:"access_token"`
		ClientID    string `json:"client_id"`
		Role        string `json:"role"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.AccessToken) == "" {
		errorJSON(w, http.StatusBadRequest, "access_token is required")
		return
	}
	if len(input.AccessToken) > 4096 {
		errorJSON(w, http.StatusBadRequest, "access_token is invalid")
		return
	}

	tokenInfoRequest, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://oauth2.googleapis.com/tokeninfo?access_token="+url.QueryEscape(strings.TrimSpace(input.AccessToken)), nil)
	if err != nil {
		errorJSON(w, http.StatusUnauthorized, "Google sign-in token is invalid")
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
	tokenInfoResponse, err := client.Do(tokenInfoRequest)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "Google sign-in could not be verified")
		return
	}
	defer tokenInfoResponse.Body.Close()
	if tokenInfoResponse.StatusCode != http.StatusOK {
		errorJSON(w, http.StatusUnauthorized, "Google sign-in token is invalid or expired")
		return
	}
	var tokenInfo struct {
		Audience  string `json:"aud"`
		ExpiresIn string `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(tokenInfoResponse.Body, 64*1024)).Decode(&tokenInfo); err != nil || !containsString(allowedClientIDs, tokenInfo.Audience) {
		errorJSON(w, http.StatusUnauthorized, "Google sign-in client is not allowed")
		return
	}
	if input.ClientID != "" && strings.TrimSpace(input.ClientID) != tokenInfo.Audience {
		errorJSON(w, http.StatusUnauthorized, "Google sign-in client does not match the token")
		return
	}
	if expires, err := strconv.Atoi(tokenInfo.ExpiresIn); err != nil || expires <= 0 {
		errorJSON(w, http.StatusUnauthorized, "Google sign-in token is expired")
		return
	}

	profileRequest, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "Google profile could not be loaded")
		return
	}
	profileRequest.Header.Set("Authorization", "Bearer "+strings.TrimSpace(input.AccessToken))
	profileResponse, err := client.Do(profileRequest)
	if err != nil {
		errorJSON(w, http.StatusBadGateway, "Google profile could not be loaded")
		return
	}
	defer profileResponse.Body.Close()
	if profileResponse.StatusCode != http.StatusOK {
		errorJSON(w, http.StatusUnauthorized, "Google profile could not be loaded")
		return
	}
	var googleProfile struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(io.LimitReader(profileResponse.Body, 128*1024)).Decode(&googleProfile); err != nil || googleProfile.Subject == "" || googleProfile.Email == "" || !googleProfile.EmailVerified {
		errorJSON(w, http.StatusForbidden, "a verified Google email is required")
		return
	}
	role := strings.ToLower(strings.TrimSpace(input.Role))
	if role == "" {
		role = "tenant"
	}
	if role != "client" && role != "tenant" {
		errorJSON(w, http.StatusBadRequest, "Google sign-in role must be client or tenant")
		return
	}

	var user CurrentUser
	err = s.db.QueryRow(r.Context(), `
		SELECT id,name,COALESCE(email,''),COALESCE(phone,''),role,status
		FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, strings.TrimSpace(strings.ToLower(googleProfile.Email))).
		Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.Status)
	if err == pgx.ErrNoRows {
		name := strings.TrimSpace(googleProfile.Name)
		if name == "" {
			name = strings.Split(googleProfile.Email, "@")[0]
		}
		err = s.db.QueryRow(r.Context(), `
			INSERT INTO users(name,email,phone,role,verified_at) VALUES($1,$2,NULL,$3,NOW())
			RETURNING id,name,COALESCE(email,''),COALESCE(phone,''),role,status`, name, strings.ToLower(strings.TrimSpace(googleProfile.Email)), role).
			Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.Status)
		if err == nil {
			_, err = s.db.Exec(r.Context(), `INSERT INTO profiles(user_id,photo_url) VALUES($1,NULLIF($2,'')) ON CONFLICT(user_id) DO NOTHING`, user.ID, strings.TrimSpace(googleProfile.Picture))
		}
	}
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			errorJSON(w, http.StatusConflict, "a user with this Google email already exists")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not create or load Google account")
		return
	}
	if user.Status != "active" {
		errorJSON(w, http.StatusForbidden, "this account is not active")
		return
	}
	token, err := s.createSession(r, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create session")
		return
	}
	profile, err := s.profileForUser(r, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "profile": profile, "access_token": token})
}

func configuredGoogleClientIDs(value string) []string {
	items := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		if value := strings.TrimSpace(item); value != "" && !containsString(items, value) {
			items = append(items, value)
		}
	}
	return items
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPatch {
		s.updateProfile(w, r)
		return
	}
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	profile, err := s.profileForUser(r, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "profile": profile})
}

func (s *Server) profileForUser(r *http.Request, userID string) (profileResponse, error) {
	var profile profileResponse
	err := s.db.QueryRow(r.Context(), `
		SELECT COALESCE(bio,''), COALESCE(photo_url,''), COALESCE(language,'en')
		FROM profiles WHERE user_id=$1`, userID).
		Scan(&profile.Bio, &profile.PhotoURL, &profile.Language)
	if err == pgx.ErrNoRows {
		return profileResponse{Language: "en"}, nil
	}
	return profile, err
}

func (s *Server) updateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32*1024)
	var input struct {
		Name     *string `json:"name"`
		Email    *string `json:"email"`
		Bio      *string `json:"bio"`
		PhotoURL *string `json:"photo_url"`
		Language *string `json:"language"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.Name != nil {
		value := strings.TrimSpace(*input.Name)
		if value == "" || len([]rune(value)) > 120 {
			errorJSON(w, http.StatusBadRequest, "name must be between 1 and 120 characters")
			return
		}
		input.Name = &value
	}
	if input.Email != nil {
		value := strings.TrimSpace(strings.ToLower(*input.Email))
		if value != "" {
			parsed, err := mail.ParseAddress(value)
			if err != nil || parsed.Address != value || len(value) > 254 {
				errorJSON(w, http.StatusBadRequest, "email is invalid")
				return
			}
		}
		input.Email = &value
	}
	if input.Bio != nil {
		value := strings.TrimSpace(*input.Bio)
		if len([]rune(value)) > 1000 {
			errorJSON(w, http.StatusBadRequest, "bio cannot exceed 1000 characters")
			return
		}
		input.Bio = &value
	}
	if input.PhotoURL != nil {
		value := strings.TrimSpace(*input.PhotoURL)
		if len(value) > 2048 {
			errorJSON(w, http.StatusBadRequest, "photo_url is too long")
			return
		}
		if value != "" {
			parsed, err := url.Parse(value)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
				errorJSON(w, http.StatusBadRequest, "photo_url must be an http or https URL")
				return
			}
		}
		input.PhotoURL = &value
	}
	if input.Language != nil {
		value := strings.ToLower(strings.TrimSpace(*input.Language))
		if value != "en" && value != "fr" && value != "rw" && value != "sw" {
			errorJSON(w, http.StatusBadRequest, "language must be en, fr, rw, or sw")
			return
		}
		input.Language = &value
	}
	if input.Name == nil && input.Email == nil && input.Bio == nil && input.PhotoURL == nil && input.Language == nil {
		errorJSON(w, http.StatusBadRequest, "at least one profile field is required")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update profile")
		return
	}
	defer tx.Rollback(r.Context())
	_, err = tx.Exec(r.Context(), `
		UPDATE users SET
		name=CASE WHEN $1::text IS NULL THEN name ELSE $1 END,
		email=CASE WHEN $2::text IS NULL THEN email ELSE NULLIF($2,'') END,
		updated_at=NOW()
		WHERE id=$3`, input.Name, input.Email, user.ID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			errorJSON(w, http.StatusConflict, "that email is already in use")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not update account")
		return
	}
	_, err = tx.Exec(r.Context(), `
		INSERT INTO profiles(user_id,bio,photo_url,language) VALUES($1,COALESCE($2,''),NULLIF($3,''),COALESCE(NULLIF($4,''),'en'))
		ON CONFLICT(user_id) DO UPDATE SET
		bio=CASE WHEN $2::text IS NULL THEN profiles.bio ELSE $2 END,
		photo_url=CASE WHEN $3::text IS NULL THEN profiles.photo_url ELSE NULLIF($3,'') END,
		language=CASE WHEN $4::text IS NULL THEN profiles.language ELSE $4 END`, user.ID, input.Bio, input.PhotoURL, input.Language)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update profile details")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish profile update")
		return
	}
	updatedUser, ok := s.userByID(r, user.ID)
	if !ok {
		errorJSON(w, http.StatusInternalServerError, "could not load updated account")
		return
	}
	profile, err := s.profileForUser(r, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load updated profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": updatedUser, "profile": profile})
}

type listingInput struct {
	Category        string     `json:"category"`
	TransactionType string     `json:"transaction_type"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	Price           float64    `json:"price"`
	Currency        string     `json:"currency"`
	Province        string     `json:"province"`
	District        string     `json:"district"`
	Sector          string     `json:"sector"`
	Cell            string     `json:"cell"`
	Village         string     `json:"village"`
	Latitude        *float64   `json:"latitude"`
	Longitude       *float64   `json:"longitude"`
	PublishAt       *time.Time `json:"publish_at"`
	Tags            []string   `json:"tags"`
	Amenities       []string   `json:"amenities"`
	ContactMethod   string     `json:"contact_method"`
	Media           []struct {
		Type string `json:"type"`
		URL  string `json:"url"`
	} `json:"media"`
	Measurements map[string]any `json:"measurements"`
}

func (s *Server) listings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.listListing(w, r)
	case http.MethodPost:
		s.createListing(w, r)
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) listListing(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	args := []any{search, q.Get("province"), q.Get("district"), q.Get("sector"), q.Get("category"), q.Get("transaction_type")}
	rows, err := s.db.Query(r.Context(), `
		SELECT l.id, l.owner_id, u.name, u.role, l.category, l.transaction_type,
		l.title, l.description, l.price, l.currency, l.province, l.district, l.sector,
		COALESCE(l.cell,''), COALESCE(l.village,''), l.latitude, l.longitude, l.status,
		l.tags, l.amenities, l.created_at
		FROM listings l JOIN users u ON u.id=l.owner_id
		WHERE l.deleted_at IS NULL AND l.status='published'
		AND ($1='' OR l.title ILIKE '%' || $1 || '%' OR l.description ILIKE '%' || $1 || '%'
			OR l.province ILIKE '%' || $1 || '%' OR l.district ILIKE '%' || $1 || '%'
			OR l.sector ILIKE '%' || $1 || '%' OR l.cell ILIKE '%' || $1 || '%'
			OR l.village ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%')
		AND ($2='' OR l.province=$2) AND ($3='' OR l.district=$3)
		AND ($4='' OR l.sector=$4) AND ($5='' OR l.category=$5)
		AND ($6='' OR l.transaction_type=$6)
		ORDER BY l.created_at DESC LIMIT 100`, args...)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load listings")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, ownerID, ownerName, ownerRole, category, transactionType, title, description string
		var price float64
		var currency, province, district, sector, cell, village, status string
		var latitude, longitude *float64
		var tags, amenities []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &ownerID, &ownerName, &ownerRole, &category, &transactionType, &title, &description, &price, &currency, &province, &district, &sector, &cell, &village, &latitude, &longitude, &status, &tags, &amenities, &createdAt); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read listings")
			return
		}
		items = append(items, map[string]any{
			"id": id, "owner": map[string]string{"id": ownerID, "name": ownerName, "role": ownerRole},
			"category": category, "transaction_type": transactionType, "title": title, "description": description,
			"price": price, "currency": currency, "province": province, "district": district, "sector": sector,
			"cell": cell, "village": village, "latitude": latitude, "longitude": longitude, "status": status,
			"tags": rawJSON(tags), "amenities": rawJSON(amenities), "created_at": createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read listings")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
}

// directory exposes only active landlord/commissioner profile information that
// is useful for discovery. Private contact details and KYC documents stay out
// of this public response.
func (s *Server) directory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("search"))
	role := strings.ToLower(strings.TrimSpace(q.Get("role")))
	if role != "" && role != "property_owner" && role != "komisiyoneri" {
		errorJSON(w, http.StatusBadRequest, "role must be property_owner or komisiyoneri")
		return
	}
	limit := 30
	if value, err := strconv.Atoi(q.Get("limit")); err == nil && value > 0 {
		if value < limit {
			limit = value
		}
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id, u.name, u.role, u.verified_at,
		       COALESCE(bp.business_name, ''), COALESCE(bp.physical_address, ''),
		       COUNT(l.id) FILTER (WHERE l.status='published' AND l.deleted_at IS NULL)
		FROM users u
		LEFT JOIN business_profiles bp ON bp.user_id=u.id
		LEFT JOIN listings l ON l.owner_id=u.id
		WHERE u.status='active'
		  AND u.role IN ('property_owner', 'komisiyoneri')
		  AND ($1='' OR u.name ILIKE '%' || $1 || '%' OR COALESCE(bp.business_name,'') ILIKE '%' || $1 || '%' OR COALESCE(bp.physical_address,'') ILIKE '%' || $1 || '%')
		  AND ($2='' OR u.role=$2)
		GROUP BY u.id, u.name, u.role, u.verified_at, bp.business_name, bp.physical_address
		ORDER BY COUNT(l.id) FILTER (WHERE l.status='published' AND l.deleted_at IS NULL) DESC, u.name ASC
		LIMIT $3`, search, role, limit)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load professional directory")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, name, userRole, businessName, address string
		var verifiedAt *time.Time
		var listingCount int
		if err := rows.Scan(&id, &name, &userRole, &verifiedAt, &businessName, &address, &listingCount); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read professional directory")
			return
		}
		items = append(items, map[string]any{
			"id": id, "name": name, "role": userRole, "business_name": businessName,
			"physical_address": address, "verified": verifiedAt != nil, "published_listings": listingCount,
		})
	}
	if err := rows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read professional directory")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
}

func (s *Server) createListing(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "komisiyoneri" && user.Role != "property_owner" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "only brokers, property owners, or admins can create listings")
		return
	}
	var input listingInput
	if !decodeJSON(w, r, &input) {
		return
	}
	input.TransactionType = strings.ToLower(strings.TrimSpace(input.TransactionType))
	if input.Category == "" || input.Title == "" || input.Province == "" || input.District == "" || input.Sector == "" || !validTransaction(input.TransactionType) {
		errorJSON(w, http.StatusBadRequest, "category, title, transaction_type, province, district, and sector are required")
		return
	}
	limit := 100
	if user.Role == "komisiyoneri" {
		limit = 10
	}
	var monthlyCount int
	if err := s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM listings WHERE owner_id=$1 AND created_at >= date_trunc('month', NOW()) AND status <> 'cancelled'`, user.ID).Scan(&monthlyCount); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not check listing quota")
		return
	}
	if monthlyCount >= limit {
		errorJSON(w, http.StatusConflict, "monthly listing quota reached")
		return
	}
	status := "published"
	if input.PublishAt != nil && input.PublishAt.After(time.Now()) {
		status = "scheduled"
	}
	expires := time.Now().Add(90 * 24 * time.Hour)
	if user.Role == "komisiyoneri" {
		expires = time.Now().Add(30 * 24 * time.Hour)
	}
	tags, _ := json.Marshal(input.Tags)
	amenities, _ := json.Marshal(input.Amenities)
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start listing creation")
		return
	}
	defer tx.Rollback(r.Context())

	var id string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO listings(owner_id, category, transaction_type, title, description, price, currency,
		province, district, sector, cell, village, latitude, longitude, status, publish_at, expires_at,
		tags, amenities, contact_method)
		VALUES($1,$2,$3,$4,$5,$6,COALESCE(NULLIF($7,''),'RWF'),$8,$9,$10,NULLIF($11,''),NULLIF($12,''),$13,$14,$15,$16,$17,$18,$19,COALESCE(NULLIF($20,''),'message')) RETURNING id`,
		user.ID, input.Category, input.TransactionType, input.Title, input.Description, input.Price, input.Currency,
		input.Province, input.District, input.Sector, input.Cell, input.Village, input.Latitude, input.Longitude,
		status, input.PublishAt, expires, tags, amenities, input.ContactMethod).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create listing")
		return
	}
	for index, media := range input.Media {
		mediaType := strings.ToLower(strings.TrimSpace(media.Type))
		if mediaType == "" {
			mediaType = "photo"
		}
		if !validMediaURL(media.URL) || !validMediaType(mediaType) {
			errorJSON(w, http.StatusBadRequest, "media entries require a valid type and URL")
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO listing_media(listing_id, media_type, url, sort_order) VALUES($1,$2,$3,$4)`, id, mediaType, strings.TrimSpace(media.URL), index); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save listing media")
			return
		}
	}
	if input.Measurements != nil {
		measurementJSON, err := json.Marshal(input.Measurements)
		if err != nil {
			errorJSON(w, http.StatusBadRequest, "measurements must be valid JSON")
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO measurements(listing_id, room_dimensions) VALUES($1,$2)`, id, measurementJSON); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not save listing measurements")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish listing creation")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": status, "expires_at": expires})
}

func (s *Server) listingRoute(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/listings/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	id := parts[0]
	if len(parts) > 1 && parts[1] == "applications" && r.Method == http.MethodPost {
		s.createApplication(w, r, id)
		return
	}
	if len(parts) > 1 && parts[1] == "media" && r.Method == http.MethodPost {
		s.uploadListingMedia(w, r, id)
		return
	}
	if len(parts) > 1 && parts[1] == "reviews" && r.Method == http.MethodGet {
		s.listReviews(w, r, id)
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.getListing(w, r, id)
	case http.MethodPatch:
		s.updateListing(w, r, id)
	case http.MethodDelete:
		s.deleteListing(w, r, id)
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

const maxListingMediaBytes int64 = 10 * 1024 * 1024

func (s *Server) uploadListingMedia(w http.ResponseWriter, r *http.Request, listingID string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var ownerID string
	if err := s.db.QueryRow(r.Context(), `SELECT owner_id FROM listings WHERE id=$1 AND deleted_at IS NULL AND status <> 'cancelled'`, listingID).Scan(&ownerID); err != nil {
		if err == pgx.ErrNoRows {
			errorJSON(w, http.StatusNotFound, "listing not found")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not load listing")
		return
	}
	if user.ID != ownerID && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "you cannot add media to this listing")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxListingMediaBytes+1024*1024)
	if err := r.ParseMultipartForm(maxListingMediaBytes + 1024*1024); err != nil {
		errorJSON(w, http.StatusBadRequest, "multipart upload is invalid or too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "a file field is required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxListingMediaBytes+1))
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not read uploaded file")
		return
	}
	if int64(len(data)) == 0 || int64(len(data)) > maxListingMediaBytes {
		errorJSON(w, http.StatusRequestEntityTooLarge, "image must be between 1 byte and 10 MB")
		return
	}
	contentType := http.DetectContentType(data)
	extension := ""
	switch contentType {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	case "image/webp":
		extension = ".webp"
	default:
		errorJSON(w, http.StatusUnsupportedMediaType, "only JPEG, PNG, and WebP images are supported")
		return
	}
	filename, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create media filename")
		return
	}
	filename += extension
	directory := filepath.Join(s.cfg.MediaUploadDir, listingID)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not prepare media storage")
		return
	}
	filePath := filepath.Join(directory, filename)
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save uploaded image")
		return
	}
	removeFile := true
	defer func() {
		if removeFile {
			_ = os.Remove(filePath)
		}
	}()
	var sortOrder int
	if err := s.db.QueryRow(r.Context(), `SELECT COALESCE(MAX(sort_order)+1,0) FROM listing_media WHERE listing_id=$1`, listingID).Scan(&sortOrder); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not prepare listing media")
		return
	}
	mediaURL := s.mediaURL(r, listingID, filename)
	var mediaID string
	if err := s.db.QueryRow(r.Context(), `INSERT INTO listing_media(listing_id,media_type,url,sort_order) VALUES($1,'photo',$2,$3) RETURNING id`, listingID, mediaURL, sortOrder).Scan(&mediaID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not save listing media")
		return
	}
	removeFile = false
	writeJSON(w, http.StatusCreated, map[string]any{"id": mediaID, "type": "photo", "url": mediaURL, "size_bytes": len(data), "filename": header.Filename})
}

func (s *Server) mediaFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	relative := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if relative == "" || strings.Contains(relative, "\\") || strings.Contains(relative, "..") {
		errorJSON(w, http.StatusNotFound, "media not found")
		return
	}
	root, err := filepath.Abs(s.cfg.MediaUploadDir)
	if err != nil {
		errorJSON(w, http.StatusNotFound, "media not found")
		return
	}
	filePath, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(relative)))
	if err != nil {
		errorJSON(w, http.StatusNotFound, "media not found")
		return
	}
	rel, err := filepath.Rel(root, filePath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		errorJSON(w, http.StatusNotFound, "media not found")
		return
	}
	http.ServeFile(w, r, filePath)
}

func (s *Server) mediaURL(r *http.Request, listingID, filename string) string {
	base := strings.TrimRight(strings.TrimSpace(s.cfg.MediaPublicBaseURL), "/")
	if base == "" {
		scheme := "http"
		if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
			scheme = "https"
		}
		base = scheme + "://" + r.Host
	}
	return base + "/uploads/" + url.PathEscape(listingID) + "/" + url.PathEscape(filename)
}

func (s *Server) getListing(w http.ResponseWriter, r *http.Request, id string) {
	var item map[string]any
	var ownerID, ownerName, ownerRole, businessName, photoURL, ownerPhone, category, transactionType, title, description, currency, province, district, sector, cell, village, status string
	var price float64
	var latitude, longitude *float64
	var tags, amenities []byte
	var createdAt, expiresAt time.Time
	var ownerVerifiedAt *time.Time
	err := s.db.QueryRow(r.Context(), `SELECT l.owner_id,u.name,u.role,COALESCE(bp.business_name,''),COALESCE(pr.photo_url,''),COALESCE(u.phone,''),u.verified_at,l.category,l.transaction_type,l.title,l.description,l.price,l.currency,l.province,l.district,l.sector,COALESCE(l.cell,''),COALESCE(l.village,''),l.latitude,l.longitude,l.status,l.tags,l.amenities,l.created_at,l.expires_at FROM listings l JOIN users u ON u.id=l.owner_id LEFT JOIN business_profiles bp ON bp.user_id=u.id LEFT JOIN profiles pr ON pr.user_id=u.id WHERE l.id=$1 AND l.deleted_at IS NULL AND l.status='published'`, id).
		Scan(&ownerID, &ownerName, &ownerRole, &businessName, &photoURL, &ownerPhone, &ownerVerifiedAt, &category, &transactionType, &title, &description, &price, &currency, &province, &district, &sector, &cell, &village, &latitude, &longitude, &status, &tags, &amenities, &createdAt, &expiresAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			errorJSON(w, http.StatusNotFound, "listing not found")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "could not load listing")
		return
	}
	poster := map[string]any{"id": ownerID, "name": ownerName, "business_name": businessName, "role": ownerRole, "photo_url": photoURL, "verified": ownerVerifiedAt != nil, "posted_at": createdAt}
	if ownerVerifiedAt != nil {
		poster["phone"] = ownerPhone
	}
	item = map[string]any{"id": id, "owner": poster, "category": category, "transaction_type": transactionType, "title": title, "description": description, "price": price, "currency": currency, "province": province, "district": district, "sector": sector, "cell": cell, "village": village, "latitude": latitude, "longitude": longitude, "status": status, "tags": rawJSON(tags), "amenities": rawJSON(amenities), "created_at": createdAt, "expires_at": expiresAt}
	rows, err := s.db.Query(r.Context(), `SELECT media_type,url,sort_order FROM listing_media WHERE listing_id=$1 ORDER BY sort_order`, id)
	media := make([]map[string]any, 0)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load listing media")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var mediaType, mediaURL string
		var order int
		if err := rows.Scan(&mediaType, &mediaURL, &order); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read listing media")
			return
		}
		media = append(media, map[string]any{"type": mediaType, "url": mediaURL, "sort_order": order})
	}
	if err := rows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read listing media")
		return
	}
	item["media"] = media
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) updateListing(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var ownerID string
	if err := s.db.QueryRow(r.Context(), `SELECT owner_id FROM listings WHERE id=$1 AND deleted_at IS NULL`, id).Scan(&ownerID); err != nil {
		errorJSON(w, http.StatusNotFound, "listing not found")
		return
	}
	if user.ID != ownerID && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "you cannot edit this listing")
		return
	}
	var input struct {
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Price       *float64 `json:"price"`
		Status      string   `json:"status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if input.Status != "" && !validListingStatus(input.Status) {
		errorJSON(w, http.StatusBadRequest, "invalid listing status")
		return
	}
	if input.Price != nil && *input.Price < 0 {
		errorJSON(w, http.StatusBadRequest, "price cannot be negative")
		return
	}
	_, err := s.db.Exec(r.Context(), `UPDATE listings SET title=COALESCE(NULLIF($1,''),title), description=COALESCE(NULLIF($2,''),description), price=COALESCE($3,price), status=COALESCE(NULLIF($4,''),status), updated_at=NOW() WHERE id=$5`, input.Title, input.Description, input.Price, input.Status, id)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update listing")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "id": id})
}

func (s *Server) deleteListing(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	result, err := s.db.Exec(r.Context(), `UPDATE listings SET status='cancelled', deleted_at=NOW(), updated_at=NOW() WHERE id=$1 AND (owner_id=$2 OR $3='admin') AND deleted_at IS NULL`, id, user.ID, user.Role)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not delete listing")
		return
	}
	if result.RowsAffected() == 0 {
		errorJSON(w, http.StatusNotFound, "listing not found or not owned by you")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

func (s *Server) createApplication(w http.ResponseWriter, r *http.Request, listingID string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		Message       string         `json:"message"`
		ApplicantInfo map[string]any `json:"applicant_info"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	info, _ := json.Marshal(input.ApplicantInfo)
	var appID, ownerID string
	err := s.db.QueryRow(r.Context(), `INSERT INTO rental_applications(listing_id, applicant_id, message, applicant_info) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM listings WHERE id=$1 AND status='published') RETURNING id, (SELECT owner_id FROM listings WHERE id=$1)`, listingID, user.ID, input.Message, info).Scan(&appID, &ownerID)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "listing is not available for applications")
		return
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'application_received','New rental application',$2)`, ownerID, fmt.Sprintf("%s applied to one of your properties", user.Name)); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create application notification")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": appID, "status": "pending"})
}

func (s *Server) applications(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT a.id,a.listing_id,l.title,a.applicant_id,u.name,a.status,a.message,a.viewed_at,a.created_at FROM rental_applications a JOIN listings l ON l.id=a.listing_id JOIN users u ON u.id=a.applicant_id WHERE a.applicant_id=$1 OR l.owner_id=$1 ORDER BY a.created_at DESC`, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load applications")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, listingID, title, applicantID, applicantName, status, message string
		var viewedAt *time.Time
		var createdAt time.Time
		if rows.Scan(&id, &listingID, &title, &applicantID, &applicantName, &status, &message, &viewedAt, &createdAt) == nil {
			items = append(items, map[string]any{"id": id, "listing_id": listingID, "listing_title": title, "applicant_id": applicantID, "applicant_name": applicantName, "status": status, "message": message, "viewed_at": viewedAt, "created_at": createdAt})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) applicationRoute(w http.ResponseWriter, r *http.Request) {
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/applications/"), "/")
	if id == "" {
		errorJSON(w, http.StatusNotFound, "application route not found")
		return
	}
	if strings.HasSuffix(id, "/viewed") {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "use POST /api/v1/applications/{id}/viewed")
			return
		}
		s.markApplicationViewed(w, r, strings.TrimSuffix(id, "/viewed"))
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST /api/v1/applications/{id}/decision")
		return
	}
	if !strings.HasSuffix(id, "/decision") {
		errorJSON(w, http.StatusNotFound, "application route not found")
		return
	}
	s.decideApplication(w, r, strings.TrimSuffix(id, "/decision"))
}

func (s *Server) decideApplication(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		Status     string   `json:"status"`
		Note       string   `json:"note"`
		RentAmount *float64 `json:"rent_amount"`
	}
	if !decodeJSON(w, r, &input) || !validApplicationStatus(input.Status) {
		errorJSON(w, http.StatusBadRequest, "status must be accepted, rejected, or more_info")
		return
	}
	if input.RentAmount != nil && *input.RentAmount <= 0 {
		errorJSON(w, http.StatusBadRequest, "rent_amount must be positive")
		return
	}
	var applicantID, listingID, ownerID string
	err := s.db.QueryRow(r.Context(), `SELECT a.applicant_id,a.listing_id,l.owner_id FROM rental_applications a JOIN listings l ON l.id=a.listing_id WHERE a.id=$1`, id).Scan(&applicantID, &listingID, &ownerID)
	if err != nil || (user.ID != ownerID && user.Role != "admin") {
		errorJSON(w, http.StatusForbidden, "you cannot decide this application")
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not start application update")
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), `UPDATE rental_applications SET status=$1, decision_note=$2, decided_at=NOW() WHERE id=$3`, input.Status, input.Note, id); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not update application")
		return
	}
	if input.Status == "accepted" {
		if _, err = tx.Exec(r.Context(), `INSERT INTO rental_agreements(listing_id,tenant_id,landlord_id,rent_amount,currency) SELECT $1,$2,l.owner_id,COALESCE($3,l.price),l.currency FROM listings l WHERE l.id=$1`, listingID, applicantID, input.RentAmount); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not create tenant relationship")
			return
		}
		_, _ = tx.Exec(r.Context(), `UPDATE users SET role='tenant', updated_at=NOW() WHERE id=$1 AND role='client'`, applicantID)
	}
	decisionBody := "Your rental application was " + input.Status
	if input.Status == "accepted" && input.RentAmount != nil {
		decisionBody = fmt.Sprintf("Your rental application was accepted at RWF %.0f per month", *input.RentAmount)
	}
	if _, err = tx.Exec(r.Context(), `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'application_decision','Rental application update',$2)`, applicantID, decisionBody); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create application notification")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not finish application update")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.Status})
}

func (s *Server) markApplicationViewed(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	result, err := s.db.Exec(r.Context(), `UPDATE rental_applications SET viewed_at=COALESCE(viewed_at,NOW()) WHERE id=$1 AND applicant_id=$2`, id, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not record property viewing")
		return
	}
	if result.RowsAffected() == 0 {
		errorJSON(w, http.StatusNotFound, "application not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "viewed", "viewed_at": time.Now()})
}

func (s *Server) payments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST /api/v1/payments")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		RelatedType string  `json:"related_type"`
		RelatedID   string  `json:"related_id"`
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		Provider    string  `json:"provider"`
		Phone       string  `json:"phone"`
	}
	if !decodeJSON(w, r, &input) || input.RelatedID == "" || input.Amount <= 0 {
		errorJSON(w, http.StatusBadRequest, "related_id and a positive amount are required")
		return
	}
	input.RelatedType = strings.ToLower(strings.TrimSpace(input.RelatedType))
	input.Provider = strings.ToLower(strings.TrimSpace(input.Provider))
	if input.RelatedType != "application" && input.RelatedType != "agreement" && input.RelatedType != "listing" {
		errorJSON(w, http.StatusBadRequest, "related_type must be application, agreement, or listing")
		return
	}
	if input.Provider != "mtn_momo" && input.Provider != "airtel_money" && input.Provider != "card" && input.Provider != "manual" {
		errorJSON(w, http.StatusBadRequest, "provider must be mtn_momo, airtel_money, card, or manual")
		return
	}
	if (input.Provider == "mtn_momo" || input.Provider == "airtel_money") && strings.TrimSpace(input.Phone) == "" {
		errorJSON(w, http.StatusBadRequest, "phone is required for mobile money payments")
		return
	}
	if !s.canPayFor(r, user.ID, input.RelatedType, input.RelatedID) {
		errorJSON(w, http.StatusForbidden, "you cannot pay for this property request")
		return
	}
	if input.Currency == "" {
		input.Currency = "RWF"
	}
	reference, err := randomToken()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create payment reference")
		return
	}
	providerReference := "UM-" + strings.ToUpper(reference[:12])
	status := "pending"
	if input.Provider == "manual" {
		status = "successful"
	}
	var id string
	err = s.db.QueryRow(r.Context(), `INSERT INTO payments(user_id,related_type,related_id,amount,currency,provider,provider_reference,status,receipt_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='successful' THEN $7 ELSE NULL END) RETURNING id`, user.ID, input.RelatedType, input.RelatedID, input.Amount, input.Currency, input.Provider, providerReference, status).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not create payment")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": status, "provider": input.Provider, "provider_reference": providerReference, "amount": input.Amount, "currency": input.Currency})
}

func (s *Server) canPayFor(r *http.Request, userID, relatedType, relatedID string) bool {
	var exists bool
	switch relatedType {
	case "application":
		_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM rental_applications WHERE id=$1 AND applicant_id=$2 AND viewed_at IS NOT NULL)`, relatedID, userID).Scan(&exists)
	case "agreement":
		_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM rental_agreements WHERE id=$1 AND tenant_id=$2)`, relatedID, userID).Scan(&exists)
	case "listing":
		_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM listings WHERE id=$1 AND status='published')`, relatedID).Scan(&exists)
	}
	return exists
}

func (s *Server) paymentRoute(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/payments/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		errorJSON(w, http.StatusNotFound, "payment not found")
		return
	}
	if len(parts) == 2 && parts[1] == "confirm" && r.Method == http.MethodPost {
		s.confirmPayment(w, r, parts[0])
		return
	}
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET /api/v1/payments/{id} or POST /api/v1/payments/{id}/confirm")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var id, relatedType, relatedID, provider, status, currency, providerReference string
	var amount float64
	var createdAt time.Time
	err := s.db.QueryRow(r.Context(), `SELECT id,related_type,COALESCE(related_id::text,''),amount,currency,provider,COALESCE(provider_reference,''),status,created_at FROM payments WHERE id=$1 AND user_id=$2`, parts[0], user.ID).Scan(&id, &relatedType, &relatedID, &amount, &currency, &provider, &providerReference, &status, &createdAt)
	if err != nil {
		errorJSON(w, http.StatusNotFound, "payment not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "related_type": relatedType, "related_id": relatedID, "amount": amount, "currency": currency, "provider": provider, "provider_reference": providerReference, "status": status, "created_at": createdAt})
}

func (s *Server) confirmPayment(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	result, err := s.db.Exec(r.Context(), `UPDATE payments SET status='successful', receipt_number=COALESCE(receipt_number,provider_reference) WHERE id=$1 AND user_id=$2 AND status='pending'`, id, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not confirm payment")
		return
	}
	if result.RowsAffected() == 0 {
		errorJSON(w, http.StatusNotFound, "pending payment not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": "successful"})
}

func (s *Server) messages(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if r.Method == http.MethodGet {
		listingID := r.URL.Query().Get("listing_id")
		rows, err := s.db.Query(r.Context(), `SELECT m.id,m.sender_id,s.name,m.recipient_id,recipient.name,COALESCE(m.listing_id::text,''),m.body,m.created_at FROM messages m JOIN users s ON s.id=m.sender_id JOIN users recipient ON recipient.id=m.recipient_id WHERE (m.sender_id=$1 OR m.recipient_id=$1) AND ($2='' OR m.listing_id=NULLIF($2,'')::uuid) ORDER BY m.created_at ASC LIMIT 200`, user.ID, listingID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load messages")
			return
		}
		defer rows.Close()
		items := make([]map[string]any, 0)
		for rows.Next() {
			var id, senderID, senderName, recipientID, recipientName, rowListingID, body string
			var createdAt time.Time
			if rows.Scan(&id, &senderID, &senderName, &recipientID, &recipientName, &rowListingID, &body, &createdAt) == nil {
				items = append(items, map[string]any{"id": id, "sender_id": senderID, "sender_name": senderName, "recipient_id": recipientID, "recipient_name": recipientName, "listing_id": rowListingID, "body": body, "created_at": createdAt})
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or POST /api/v1/messages")
		return
	}
	var input struct {
		ListingID   string `json:"listing_id"`
		RecipientID string `json:"recipient_id"`
		Body        string `json:"body"`
	}
	if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Body) == "" {
		errorJSON(w, http.StatusBadRequest, "message body is required")
		return
	}
	if input.RecipientID == "" && input.ListingID != "" {
		_ = s.db.QueryRow(r.Context(), `SELECT owner_id FROM listings WHERE id=$1 AND status='published'`, input.ListingID).Scan(&input.RecipientID)
	}
	if input.RecipientID == "" || input.RecipientID == user.ID {
		errorJSON(w, http.StatusBadRequest, "a valid landlord recipient is required")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO messages(sender_id,recipient_id,listing_id,body) VALUES($1,$2,NULLIF($3,'')::uuid,$4) RETURNING id`, user.ID, input.RecipientID, input.ListingID, strings.TrimSpace(input.Body)).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not send message")
		return
	}
	if _, err = s.db.Exec(r.Context(), `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'message_received','New message',$2)`, input.RecipientID, fmt.Sprintf("%s sent you a message", user.Name)); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not create message notification")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "sent"})
}

func (s *Server) reviews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "use POST /api/v1/reviews")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		ListingID   string `json:"listing_id"`
		AgreementID string `json:"agreement_id"`
		Rating      int    `json:"rating"`
		Body        string `json:"body"`
	}
	if !decodeJSON(w, r, &input) || input.ListingID == "" || input.Rating < 1 || input.Rating > 5 {
		errorJSON(w, http.StatusBadRequest, "listing_id and a rating from 1 to 5 are required")
		return
	}
	var eligible bool
	_ = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM rental_applications WHERE listing_id=$1 AND applicant_id=$2 AND viewed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM rental_agreements WHERE listing_id=$1 AND tenant_id=$2)`, input.ListingID, user.ID).Scan(&eligible)
	if !eligible {
		errorJSON(w, http.StatusForbidden, "you can review a property after viewing it")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO reviews(author_id,listing_id,agreement_id,rating,body) VALUES($1,$2,NULLIF($3,'')::uuid,$4,$5) RETURNING id`, user.ID, input.ListingID, input.AgreementID, input.Rating, strings.TrimSpace(input.Body)).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusConflict, "you have already reviewed this property")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "published", "rating": input.Rating})
}

func (s *Server) listReviews(w http.ResponseWriter, r *http.Request, listingID string) {
	rows, err := s.db.Query(r.Context(), `SELECT r.id,r.author_id,u.name,r.rating,r.body,r.created_at FROM reviews r JOIN users u ON u.id=r.author_id WHERE r.listing_id=$1 ORDER BY r.created_at DESC`, listingID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load reviews")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, authorID, authorName, body string
		var rating int
		var createdAt time.Time
		if rows.Scan(&id, &authorID, &authorName, &rating, &body, &createdAt) == nil {
			items = append(items, map[string]any{"id": id, "author_id": authorID, "author_name": authorName, "rating": rating, "body": body, "created_at": createdAt})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) bookings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		ListingID string `json:"listing_id"`
		CheckIn   string `json:"check_in"`
		CheckOut  string `json:"check_out"`
		Guests    int    `json:"guests"`
	}
	if !decodeJSON(w, r, &input) || input.ListingID == "" || input.CheckIn == "" || input.CheckOut == "" {
		errorJSON(w, http.StatusBadRequest, "listing_id, check_in, and check_out are required")
		return
	}
	if input.Guests < 1 {
		input.Guests = 1
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO bookings(listing_id,guest_id,check_in,check_out,guests) VALUES($1,$2,$3,$4,$5) RETURNING id`, input.ListingID, user.ID, input.CheckIn, input.CheckOut, input.Guests).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not create booking")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "requested"})
}

func (s *Server) reports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		ListingID      string `json:"listing_id"`
		ReportedUserID string `json:"reported_user_id"`
		Reason         string `json:"reason"`
		Details        string `json:"details"`
	}
	if !decodeJSON(w, r, &input) || !validReportReason(input.Reason) {
		errorJSON(w, http.StatusBadRequest, "a valid report reason is required")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO reports(reporter_id,listing_id,reported_user_id,reason,details) VALUES($1,NULLIF($2,'')::uuid,NULLIF($3,'')::uuid,$4,$5) RETURNING id`, user.ID, input.ListingID, input.ReportedUserID, input.Reason, input.Details).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not submit report")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "pending"})
}

func (s *Server) adminLocations(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "administrator access required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(r.Context(), `SELECT DISTINCT province,district,sector,COALESCE(cell,''),COALESCE(village,'') FROM administrative_locations ORDER BY province,district,sector,cell,village`)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load administrative locations")
			return
		}
		defer rows.Close()
		items := make([]map[string]string, 0)
		for rows.Next() {
			var province, district, sector, cell, village string
			if err := rows.Scan(&province, &district, &sector, &cell, &village); err != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read administrative locations")
				return
			}
			items = append(items, map[string]string{"province": province, "district": district, "sector": sector, "cell": cell, "village": village})
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
	case http.MethodPost:
		var input struct {
			Province string `json:"province"`
			District string `json:"district"`
			Sector   string `json:"sector"`
			Cell     string `json:"cell"`
			Village  string `json:"village"`
		}
		if !decodeJSON(w, r, &input) || strings.TrimSpace(input.Province) == "" || strings.TrimSpace(input.District) == "" || strings.TrimSpace(input.Sector) == "" {
			errorJSON(w, http.StatusBadRequest, "province, district, and sector are required")
			return
		}
		var exists bool
		err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM administrative_locations WHERE province=$1 AND district=$2 AND sector=$3 AND COALESCE(cell,'')=COALESCE($4,'') AND COALESCE(village,'')=COALESCE($5,''))`, strings.TrimSpace(input.Province), strings.TrimSpace(input.District), strings.TrimSpace(input.Sector), strings.TrimSpace(input.Cell), strings.TrimSpace(input.Village)).Scan(&exists)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not validate administrative location")
			return
		}
		if !exists {
			_, err = s.db.Exec(r.Context(), `INSERT INTO administrative_locations(province,district,sector,cell,village) VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''))`, strings.TrimSpace(input.Province), strings.TrimSpace(input.District), strings.TrimSpace(input.Sector), strings.TrimSpace(input.Cell), strings.TrimSpace(input.Village))
			if err != nil {
				errorJSON(w, http.StatusInternalServerError, "could not save administrative location")
				return
			}
		}
		writeJSON(w, http.StatusCreated, map[string]string{"status": "saved"})
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or POST /api/v1/admin/locations")
	}
}

func (s *Server) adminReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "administrator access required")
		return
	}
	limit := 100
	if value, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && value > 0 && value < limit {
		limit = value
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := s.db.Query(r.Context(), `
		SELECT r.id, COALESCE(r.listing_id::text,''), COALESCE(l.title,''),
		       r.reporter_id, COALESCE(reporter.name,''), COALESCE(r.reported_user_id::text,''),
		       COALESCE(reported.name,''), r.reason, r.details, r.status, r.created_at
		FROM reports r
		JOIN users reporter ON reporter.id=r.reporter_id
		LEFT JOIN listings l ON l.id=r.listing_id
		LEFT JOIN users reported ON reported.id=r.reported_user_id
		WHERE ($1='' OR r.status=$1)
		ORDER BY r.created_at DESC
		LIMIT $2`, status, limit)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load moderation reports")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, listingID, listingTitle, reporterID, reporterName, reportedUserID, reportedName, reason, details, reportStatus string
		var createdAt time.Time
		if err := rows.Scan(&id, &listingID, &listingTitle, &reporterID, &reporterName, &reportedUserID, &reportedName, &reason, &details, &reportStatus, &createdAt); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read moderation reports")
			return
		}
		items = append(items, map[string]any{
			"id": id, "listing_id": listingID, "listing_title": listingTitle,
			"reporter_id": reporterID, "reporter_name": reporterName,
			"reported_user_id": reportedUserID, "reported_user_name": reportedName,
			"reason": reason, "details": details, "status": reportStatus, "created_at": createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not read moderation reports")
		return
	}
	var pending, reviewing, resolved, dismissed int
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(*) FILTER (WHERE status='pending'), COUNT(*) FILTER (WHERE status='reviewing'), COUNT(*) FILTER (WHERE status='resolved'), COUNT(*) FILTER (WHERE status='dismissed') FROM reports`).Scan(&pending, &reviewing, &resolved, &dismissed)
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items, "count": len(items),
		"summary": map[string]int{"pending": pending, "reviewing": reviewing, "resolved": resolved, "dismissed": dismissed},
	})
}

func (s *Server) adminReportRoute(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "administrator access required")
		return
	}
	if r.Method != http.MethodPatch {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/reports/")
	if id == "" || strings.Contains(id, "/") {
		errorJSON(w, http.StatusBadRequest, "report id is required")
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &input) || (input.Status != "pending" && input.Status != "reviewing" && input.Status != "resolved" && input.Status != "dismissed") {
		errorJSON(w, http.StatusBadRequest, "invalid report status")
		return
	}
	result, err := s.db.Exec(r.Context(), `UPDATE reports SET status=$1 WHERE id=$2`, input.Status, id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not update report")
		return
	}
	if result.RowsAffected() == 0 {
		errorJSON(w, http.StatusNotFound, "report not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "status": input.Status})
}

func (s *Server) favorites(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}

	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(r.Context(), `SELECT property_key,title,property_type,location,price,image_url,created_at FROM favorites WHERE user_id=$1 ORDER BY created_at DESC`, user.ID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not load favorites")
			return
		}
		defer rows.Close()
		items := make([]map[string]any, 0)
		for rows.Next() {
			var propertyKey, title, propertyType, location, price, imageURL string
			var createdAt time.Time
			if err := rows.Scan(&propertyKey, &title, &propertyType, &location, &price, &imageURL, &createdAt); err != nil {
				errorJSON(w, http.StatusInternalServerError, "could not read favorites")
				return
			}
			items = append(items, map[string]any{"property_id": propertyKey, "title": title, "type": propertyType, "location": location, "price": price, "image": imageURL, "saved_at": createdAt})
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var input struct {
			PropertyID string `json:"property_id"`
			Title      string `json:"title"`
			Type       string `json:"type"`
			Location   string `json:"location"`
			Price      string `json:"price"`
			Image      string `json:"image"`
		}
		if !decodeJSON(w, r, &input) || strings.TrimSpace(input.PropertyID) == "" || strings.TrimSpace(input.Title) == "" {
			errorJSON(w, http.StatusBadRequest, "property_id and title are required")
			return
		}
		var id string
		err := s.db.QueryRow(r.Context(), `INSERT INTO favorites(user_id,property_key,title,property_type,location,price,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,property_key) DO UPDATE SET title=EXCLUDED.title,property_type=EXCLUDED.property_type,location=EXCLUDED.location,price=EXCLUDED.price,image_url=EXCLUDED.image_url RETURNING id`, user.ID, strings.TrimSpace(input.PropertyID), strings.TrimSpace(input.Title), strings.TrimSpace(input.Type), strings.TrimSpace(input.Location), strings.TrimSpace(input.Price), strings.TrimSpace(input.Image)).Scan(&id)
		if err != nil {
			errorJSON(w, http.StatusBadRequest, "could not save favorite")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id, "property_id": strings.TrimSpace(input.PropertyID)})
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "use GET or POST /api/v1/favorites")
	}
}

func (s *Server) favoriteRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		errorJSON(w, http.StatusMethodNotAllowed, "use DELETE /api/v1/favorites/{property_id}")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	propertyKey, err := url.PathUnescape(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/favorites/"), "/"))
	if err != nil || strings.TrimSpace(propertyKey) == "" {
		errorJSON(w, http.StatusBadRequest, "property_id is required")
		return
	}
	result, err := s.db.Exec(r.Context(), `DELETE FROM favorites WHERE user_id=$1 AND property_key=$2`, user.ID, propertyKey)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not remove favorite")
		return
	}
	if result.RowsAffected() == 0 {
		errorJSON(w, http.StatusNotFound, "favorite not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"property_id": propertyKey, "status": "removed"})
}

func (s *Server) notifications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,type,title,body,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, typ, title, body string
		var readAt *time.Time
		var createdAt time.Time
		if rows.Scan(&id, &typ, &title, &body, &readAt, &createdAt) == nil {
			items = append(items, map[string]any{"id": id, "type": typ, "title": title, "body": body, "read_at": readAt, "created_at": createdAt})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) ownerDashboard(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "property_owner" && user.Role != "komisiyoneri" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "owner dashboard access required")
		return
	}
	var listingsCount, activeListings, applicationsCount, tenantsCount int
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM listings WHERE owner_id=$1 AND deleted_at IS NULL`, user.ID).Scan(&listingsCount)
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM listings WHERE owner_id=$1 AND status='published'`, user.ID).Scan(&activeListings)
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM rental_applications a JOIN listings l ON l.id=a.listing_id WHERE l.owner_id=$1 AND a.status='pending'`, user.ID).Scan(&applicationsCount)
	_ = s.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM rental_agreements WHERE landlord_id=$1 AND status='active'`, user.ID).Scan(&tenantsCount)
	writeJSON(w, http.StatusOK, map[string]any{"listings": listingsCount, "active_listings": activeListings, "pending_applications": applicationsCount, "active_tenants": tenantsCount})
}

func (s *Server) ownerListings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if user.Role != "property_owner" && user.Role != "komisiyoneri" && user.Role != "admin" {
		errorJSON(w, http.StatusForbidden, "owner dashboard access required")
		return
	}
	ownerID := user.ID
	ownerFilter := "l.owner_id=$1"
	args := []any{ownerID}
	if user.Role == "admin" {
		ownerFilter = "TRUE"
		args = nil
	}
	rows, err := s.db.Query(r.Context(), fmt.Sprintf(`
		SELECT l.id,l.category,l.transaction_type,l.title,l.description,l.price,l.currency,
		l.province,l.district,l.sector,COALESCE(l.cell,''),COALESCE(l.village,''),l.status,
		l.tags,l.amenities,l.created_at,COALESCE((SELECT url FROM listing_media lm WHERE lm.listing_id=l.id ORDER BY lm.sort_order LIMIT 1),'')
		FROM listings l WHERE %s AND l.deleted_at IS NULL ORDER BY l.created_at DESC`, ownerFilter), args...)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load owner listings")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id, category, transactionType, title, description, currency, province, district, sector, cell, village, status, cover string
		var price float64
		var tags, amenities []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &category, &transactionType, &title, &description, &price, &currency, &province, &district, &sector, &cell, &village, &status, &tags, &amenities, &createdAt, &cover); err != nil {
			errorJSON(w, http.StatusInternalServerError, "could not read owner listings")
			return
		}
		items = append(items, map[string]any{
			"id": id, "category": category, "transaction_type": transactionType, "title": title, "description": description,
			"price": price, "currency": currency, "province": province, "district": district, "sector": sector,
			"cell": cell, "village": village, "status": status, "tags": rawJSON(tags), "amenities": rawJSON(amenities),
			"cover": cover, "created_at": createdAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
}

func (s *Server) tenantDashboard(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT ra.id,ra.listing_id,l.title,ra.rent_amount,ra.currency,ra.due_day,ra.start_date,ra.end_date,ra.status FROM rental_agreements ra LEFT JOIN listings l ON l.id=ra.listing_id WHERE ra.tenant_id=$1 ORDER BY ra.created_at DESC`, user.ID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "could not load tenant account")
		return
	}
	defer rows.Close()
	properties := make([]map[string]any, 0)
	for rows.Next() {
		var id, listingID, title, currency, status string
		var rent float64
		var dueDay int
		var startDate, endDate *time.Time
		if rows.Scan(&id, &listingID, &title, &rent, &currency, &dueDay, &startDate, &endDate, &status) == nil {
			properties = append(properties, map[string]any{"agreement_id": id, "listing_id": listingID, "title": title, "rent_amount": rent, "currency": currency, "due_day": dueDay, "start_date": startDate, "end_date": endDate, "status": status})
		}
	}
	applications := make([]map[string]any, 0)
	applicationRows, _ := s.db.Query(r.Context(), `SELECT a.id,a.listing_id,l.title,a.status,a.message,a.viewed_at,a.created_at FROM rental_applications a JOIN listings l ON l.id=a.listing_id WHERE a.applicant_id=$1 ORDER BY a.created_at DESC`, user.ID)
	if applicationRows != nil {
		defer applicationRows.Close()
		for applicationRows.Next() {
			var id, listingID, title, status, message string
			var viewedAt *time.Time
			var createdAt time.Time
			if applicationRows.Scan(&id, &listingID, &title, &status, &message, &viewedAt, &createdAt) == nil {
				applications = append(applications, map[string]any{"id": id, "listing_id": listingID, "listing_title": title, "status": status, "message": message, "viewed_at": viewedAt, "created_at": createdAt})
			}
		}
	}

	payments := make([]map[string]any, 0)
	paymentRows, _ := s.db.Query(r.Context(), `SELECT id,related_type,COALESCE(related_id::text,''),amount,currency,provider,status,COALESCE(receipt_number,''),created_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, user.ID)
	if paymentRows != nil {
		defer paymentRows.Close()
		for paymentRows.Next() {
			var id, relatedType, relatedID, currency, provider, status, receipt string
			var amount float64
			var createdAt time.Time
			if paymentRows.Scan(&id, &relatedType, &relatedID, &amount, &currency, &provider, &status, &receipt, &createdAt) == nil {
				payments = append(payments, map[string]any{"id": id, "related_type": relatedType, "related_id": relatedID, "amount": amount, "currency": currency, "provider": provider, "status": status, "receipt_number": receipt, "created_at": createdAt})
			}
		}
	}

	messages := make([]map[string]any, 0)
	messageRows, _ := s.db.Query(r.Context(), `SELECT m.id,m.sender_id,s.name,m.recipient_id,recipient.name,COALESCE(m.listing_id::text,''),m.body,m.created_at FROM messages m JOIN users s ON s.id=m.sender_id JOIN users recipient ON recipient.id=m.recipient_id WHERE m.sender_id=$1 OR m.recipient_id=$1 ORDER BY m.created_at DESC LIMIT 100`, user.ID)
	if messageRows != nil {
		defer messageRows.Close()
		for messageRows.Next() {
			var id, senderID, senderName, recipientID, recipientName, listingID, body string
			var createdAt time.Time
			if messageRows.Scan(&id, &senderID, &senderName, &recipientID, &recipientName, &listingID, &body, &createdAt) == nil {
				messages = append(messages, map[string]any{"id": id, "sender_id": senderID, "sender_name": senderName, "recipient_id": recipientID, "recipient_name": recipientName, "listing_id": listingID, "body": body, "created_at": createdAt})
			}
		}
	}

	reviews := make([]map[string]any, 0)
	reviewRows, _ := s.db.Query(r.Context(), `SELECT r.id,r.listing_id,l.title,r.rating,r.body,r.created_at FROM reviews r LEFT JOIN listings l ON l.id=r.listing_id WHERE r.author_id=$1 ORDER BY r.created_at DESC LIMIT 100`, user.ID)
	if reviewRows != nil {
		defer reviewRows.Close()
		for reviewRows.Next() {
			var id, listingID, title, body string
			var rating int
			var createdAt time.Time
			if reviewRows.Scan(&id, &listingID, &title, &rating, &body, &createdAt) == nil {
				reviews = append(reviews, map[string]any{"id": id, "listing_id": listingID, "listing_title": title, "rating": rating, "body": body, "created_at": createdAt})
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"properties": properties, "applications": applications, "payments": payments, "messages": messages, "reviews": reviews})
}

func (s *Server) maintenance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user, ok := s.authUser(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input struct {
		LandlordID     string `json:"landlord_id"`
		PropertyUnitID string `json:"property_unit_id"`
		Title          string `json:"title"`
		Description    string `json:"description"`
	}
	if !decodeJSON(w, r, &input) || input.LandlordID == "" || input.Title == "" || input.Description == "" {
		errorJSON(w, http.StatusBadRequest, "landlord_id, title, and description are required")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `INSERT INTO maintenance_requests(tenant_id,landlord_id,property_unit_id,title,description) VALUES($1,$2,NULLIF($3,'')::uuid,$4,$5) RETURNING id`, user.ID, input.LandlordID, input.PropertyUnitID, input.Title, input.Description).Scan(&id)
	if err != nil {
		errorJSON(w, http.StatusBadRequest, "could not create maintenance request")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "open"})
}

func (s *Server) authUser(r *http.Request) (CurrentUser, bool) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return CurrentUser{}, false
	}
	token := strings.TrimSpace(header[len("Bearer "):])
	if token == "" {
		return CurrentUser{}, false
	}
	var user CurrentUser
	err := s.db.QueryRow(r.Context(), `SELECT u.id,u.name,COALESCE(u.email,''),COALESCE(u.phone,''),u.role,u.status FROM sessions se JOIN users u ON u.id=se.user_id WHERE se.token_hash=$1 AND se.expires_at > NOW() AND u.status='active'`, hash(token)).Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.Status)
	return user, err == nil
}

func (s *Server) userByID(r *http.Request, id string) (CurrentUser, bool) {
	var user CurrentUser
	err := s.db.QueryRow(r.Context(), `SELECT id,name,COALESCE(email,''),COALESCE(phone,''),role,status FROM users WHERE id=$1`, id).Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.Status)
	return user, err == nil
}

func (s *Server) createSession(r *http.Request, userID string) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(r.Context(), `INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')`, userID, hash(token))
	return token, err
}

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if s.corsOrigin(origin) != "" {
			w.Header().Set("Access-Control-Allow-Origin", s.corsOrigin(origin))
			if s.cfg.CorsOrigins != "*" {
				w.Header().Add("Vary", "Origin")
			}
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Max-Age", "600")
		if !strings.HasPrefix(r.URL.Path, "/uploads/") {
			w.Header().Set("Content-Type", "application/json")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		defer func() {
			if recovered := recover(); recovered != nil {
				errorJSON(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) corsOrigin(origin string) string {
	if origin == "" {
		return ""
	}
	if strings.TrimSpace(s.cfg.CorsOrigins) == "*" {
		return "*"
	}
	for _, allowed := range strings.Split(s.cfg.CorsOrigins, ",") {
		if strings.TrimSpace(allowed) == origin {
			return origin
		}
	}
	return ""
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(target); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func errorJSON(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func validRole(role string) bool {
	switch role {
	case "client", "tenant", "komisiyoneri", "property_owner", "admin":
		return true
	default:
		return false
	}
}

func validTransaction(value string) bool {
	switch value {
	case "buy", "sell", "rent", "rent_out", "book":
		return true
	default:
		return false
	}
}

func validMediaType(value string) bool {
	return value == "photo" || value == "video" || value == "tour_3d"
}

func validMediaURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 2048 {
		return false
	}
	parsed, err := url.Parse(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

func validListingStatus(value string) bool {
	switch value {
	case "draft", "scheduled", "published", "expired", "cancelled":
		return true
	default:
		return false
	}
}

func validApplicationStatus(value string) bool {
	return value == "accepted" || value == "rejected" || value == "more_info"
}

func validReportReason(value string) bool {
	switch value {
	case "fraud", "duplicate", "incorrect_information", "sold_unavailable", "offensive_content", "other":
		return true
	default:
		return false
	}
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func randomDigits(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "111111"
	}
	for i := range b {
		b[i] = '0' + (b[i] % 10)
	}
	return string(b)
}

func hash(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func rawJSON(value []byte) any {
	if len(value) == 0 {
		return []any{}
	}
	var decoded any
	if json.Unmarshal(value, &decoded) != nil {
		return []any{}
	}
	return decoded
}
