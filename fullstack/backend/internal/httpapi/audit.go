package httpapi

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgconn"
)

// execer is satisfied by both *pgxpool.Pool and pgx.Tx, so audit entries can
// be written inside the same transaction as the change they describe.
type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// writeAudit records a sensitive change. before/after are marshalled to JSON;
// pass nil when a side does not apply. entityID may be empty.
func writeAudit(ctx context.Context, db execer, actorID, action, entityType, entityID string, before, after any) error {
	marshal := func(value any) ([]byte, error) {
		if value == nil {
			return nil, nil
		}
		return json.Marshal(value)
	}
	beforeJSON, err := marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := marshal(after)
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state) VALUES(NULLIF($1,'')::uuid,$2,$3,NULLIF($4,'')::uuid,$5,$6)`,
		actorID, action, entityType, entityID, beforeJSON, afterJSON)
	return err
}
