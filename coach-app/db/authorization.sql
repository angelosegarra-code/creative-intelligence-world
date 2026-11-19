-- Every query must use the authenticated session user id as a bound parameter.
-- Coach's active clients:
SELECT u.id,u.email FROM relationships r JOIN users u ON u.id=r.client_id
WHERE r.coach_id=? AND r.revoked_at IS NULL;
-- Client's assigned challenges:
SELECT c.id,c.text,c.created_at FROM challenges c JOIN relationships r
ON r.coach_id=c.coach_id AND r.client_id=c.client_id
WHERE c.client_id=? AND r.revoked_at IS NULL;
-- Coach's authorized reflections:
SELECT f.id,f.challenge_id,f.text,f.created_at FROM reflections f
JOIN challenges c ON c.id=f.challenge_id
JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id
WHERE c.coach_id=? AND r.revoked_at IS NULL;
