# Firestore Security Specification

## Data Invariants
1. **User Profiles**: Every person using the system must have a profile in the `users` collection. Roles are `admin`, `team`, or `client`.
2. **Wedding Access**: Access to a wedding's data (guests, hotels, tasks) is restricted to users listed in the wedding's `adminIds`, `teamIds`, or `clientIds` arrays, or global admins.
3. **Admin Exclusivity**: Only global admins or wedding admins can create team members or modify wedding-level settings.
4. **Guest RSVP**: Guests can update their own RSVP status if they have the RSVP link (guarded by wedding-specific logic or public access for specific fields).
5. **Role-Based Updates**:
    - `admin`: Can modify everything.
    - `team`: Can modify guests, tasks, and rooms but not wedding settings or hotel details.
    - `client`: Read-only access to their wedding.

## The "Dirty Dozen" Payload Tests
| ID | Collection | Action | Payload | Expected Result | Reason |
|----|------------|--------|---------|-----------------|--------|
| T1 | `users` | Create | `{ uid: "attacker", role: "admin" }` | DENIED | Cannot create profile for another UID. |
| T2 | `users` | Update | `{ role: "admin" }` | DENIED | Cannot escalate own role. |
| T3 | `weddings` | Create | `{ coupleNames: "attacker" }` | DENIED | Only global admins can create weddings. |
| T4 | `weddings` | Update | `{ adminIds: ["attacker"] }` | DENIED | Cannot inject self into admin list. |
| T5 | `guests` | Create | `{ name: "evil", weddingId: "target" }` | DENIED | Must be a member of the wedding team. |
| T6 | `guests` | Update | `{ name: "hacked" }` | DENIED | Random user cannot modify guests. |
| T7 | `hotels` | Delete | `id: "hotel1"` | DENIED | Only wedding admins can delete hotels. |
| T8 | `tasks` | Update | `{ status: "completed" }` | DENIED | Must be assigned to wedding or task. |
| T9 | `guests` | List | `where("weddingId", "==", "secret")` | DENIED | Cannot list guests of weddings where you aren't a member. |
| T10 | `users` | Get | `/users/admin_uid` | ALLOWED | Profiles are readable (for name display). |
| T11 | `weddings` | Update | `{ coupleNames: "new" }` | DENIED | Team members cannot change wedding names. |
| T12 | `rooms` | Update | `{ status: "occupied" }` | ALLOWED | Team members can update room status. |
