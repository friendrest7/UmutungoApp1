package httpapi

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
)

func validateMoMoPayment(expectedReference string, expectedAmount float64, expectedCurrency string, result momoPaymentStatus) error {
	if strings.TrimSpace(result.ExternalID) != expectedReference {
		return fmt.Errorf("provider transaction reference mismatch")
	}
	if result.Amount == "" || result.Currency == "" {
		return fmt.Errorf("provider response is missing amount or currency")
	}
	providerAmount, err := strconv.ParseFloat(strings.TrimSpace(result.Amount), 64)
	if err != nil || math.IsNaN(providerAmount) || math.IsInf(providerAmount, 0) || math.Abs(providerAmount-expectedAmount) > 0.000001 {
		return fmt.Errorf("provider payment amount mismatch")
	}
	if !strings.EqualFold(strings.TrimSpace(result.Currency), strings.TrimSpace(expectedCurrency)) {
		return fmt.Errorf("provider payment currency mismatch")
	}
	if result.Status == "successful" && strings.TrimSpace(result.FinancialTransactionID) == "" {
		return fmt.Errorf("successful provider status is missing its transaction id")
	}
	return nil
}

func shouldApplyPaymentTransition(currentStatus, providerStatus string) bool {
	return currentStatus == "pending" && (providerStatus == "successful" || providerStatus == "failed" || providerStatus == "expired")
}

// applyVerifiedPayment atomically records the provider-confirmed final state
// and its notifications. Only a pending row can produce side effects, so
// repeated status polls and callbacks are safe.
func (s *Server) applyVerifiedPayment(ctx context.Context, paymentID, providerStatus, financialTransactionID string) error {
	if !shouldApplyPaymentTransition("pending", providerStatus) {
		return fmt.Errorf("payment status is not final")
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var userID, userName, relatedType, relatedID, currentStatus string
	if err := tx.QueryRow(ctx, `SELECT p.user_id::text,u.name,p.related_type,COALESCE(p.related_id::text,''),p.status FROM payments p JOIN users u ON u.id=p.user_id WHERE p.id=$1 FOR UPDATE OF p`, paymentID).Scan(&userID, &userName, &relatedType, &relatedID, &currentStatus); err != nil {
		return err
	}
	if !shouldApplyPaymentTransition(currentStatus, providerStatus) {
		return tx.Commit(ctx)
	}
	if providerStatus == "successful" && financialTransactionID == "" {
		return fmt.Errorf("successful provider status is missing its transaction id")
	}
	if _, err := tx.Exec(ctx, `UPDATE payments SET status=$2,provider_transaction_id=NULLIF($3,''),receipt_number=CASE WHEN $2='successful' THEN NULLIF($3,'') ELSE receipt_number END WHERE id=$1 AND status='pending'`, paymentID, providerStatus, financialTransactionID); err != nil {
		return err
	}
	if relatedType == "owner_upgrade" {
		var ownerID, plan string
		if err := tx.QueryRow(ctx, `SELECT owner_id::text,plan FROM owner_upgrade_purchases WHERE payment_id=$1 FOR UPDATE`, paymentID).Scan(&ownerID, &plan); err != nil {
			return err
		}
		if providerStatus == "successful" {
			if plan != "diamond" {
				if _, err := tx.Exec(ctx, `UPDATE owner_upgrade_purchases SET status='expired' WHERE owner_id=$1 AND status='active' AND plan <> 'diamond'`, ownerID); err != nil {
					return err
				}
			}
			if _, err := tx.Exec(ctx, `UPDATE owner_upgrade_purchases SET status='active',purchased_at=NOW(),activated_at=NOW(),expires_at=CASE plan WHEN 'diamond' THEN NULL WHEN 'silver' THEN NOW()+INTERVAL '90 days' WHEN 'gold' THEN NOW()+INTERVAL '180 days' ELSE NOW()+INTERVAL '365 days' END,provider_transaction_id=$2,verified_at=NOW() WHERE payment_id=$1`, paymentID, financialTransactionID); err != nil {
				return err
			}
		} else if _, err := tx.Exec(ctx, `UPDATE owner_upgrade_purchases SET status=$2 WHERE payment_id=$1 AND status='pending'`, paymentID, providerStatus); err != nil {
			return err
		}
		if providerStatus != "successful" {
			if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'payment_'||$2,'Owner plan payment '||$2,$3)`, userID, providerStatus, "Your owner plan payment was not completed."); err != nil {
				return err
			}
		}
		return tx.Commit(ctx)
	}
	var ownerID, listingTitle string
	switch relatedType {
	case "booking":
		if err := tx.QueryRow(ctx, `SELECT l.owner_id::text,l.title FROM bookings b JOIN listings l ON l.id=b.listing_id WHERE b.id=$1`, relatedID).Scan(&ownerID, &listingTitle); err != nil {
			return err
		}
	case "listing":
		if err := tx.QueryRow(ctx, `SELECT owner_id::text,title FROM listings WHERE id=$1`, relatedID).Scan(&ownerID, &listingTitle); err != nil {
			return err
		}
	case "application":
		if err := tx.QueryRow(ctx, `SELECT l.owner_id::text,l.title FROM rental_applications a JOIN listings l ON l.id=a.listing_id WHERE a.id=$1`, relatedID).Scan(&ownerID, &listingTitle); err != nil {
			return err
		}
	case "agreement":
		if err := tx.QueryRow(ctx, `SELECT l.owner_id::text,l.title FROM rental_agreements a JOIN listings l ON l.id=a.listing_id WHERE a.id=$1`, relatedID).Scan(&ownerID, &listingTitle); err != nil {
			return err
		}
	}
	if providerStatus == "successful" {
		if ownerID != "" && ownerID != userID {
			if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'payment_confirmed','Booking payment confirmed',$2)`, ownerID, fmt.Sprintf("%s completed payment for %s.", userName, listingTitle)); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'payment_confirmed','Payment confirmed',$2)`, userID, fmt.Sprintf("Your payment for %s was confirmed by MTN MoMo.", listingTitle)); err != nil {
			return err
		}
	} else {
		title := "Payment failed"
		message := "MTN MoMo could not complete your payment."
		if providerStatus == "expired" {
			title = "Payment expired"
			message = "The MTN MoMo payment request expired before it was completed. You can start a new request."
		}
		if _, err := tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'payment_'||$2,$3,$4)`, userID, providerStatus, title, message); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
