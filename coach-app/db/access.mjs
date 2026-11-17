// Prototype of server-side, parameter-bound data access. NOT wired to the HTTP server yet.
import { DatabaseSync } from 'node:sqlite';
export function openStore(path){const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');return {
close:()=>db.close(),
clientsForCoach:(coachId)=>db.prepare("SELECT u.id,u.email FROM relationships r JOIN users u ON u.id=r.client_id WHERE r.coach_id=? AND r.revoked_at IS NULL").all(coachId),
challengesForClient:(clientId)=>db.prepare("SELECT c.id,c.text,c.created_at FROM challenges c JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE c.client_id=? AND r.revoked_at IS NULL").all(clientId),
reflectionsForCoach:(coachId)=>db.prepare("SELECT f.id,f.challenge_id,f.text,f.created_at FROM reflections f JOIN challenges c ON c.id=f.challenge_id JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE c.coach_id=? AND r.revoked_at IS NULL").all(coachId),
revoke:(coachId,clientId)=>db.prepare("UPDATE relationships SET revoked_at=CURRENT_TIMESTAMP WHERE coach_id=? AND client_id=? AND revoked_at IS NULL").run(coachId,clientId),
};}
