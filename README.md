# 🎟️ TicketBook — Online Ticket Booking System v2

A polished HTML/CSS/vanilla-JavaScript ticket-booking project with a realistic customer flow, secure browser-side authentication demo, dynamic event discovery, seat selection, checkout, payment-gateway handoff, digital tickets, caching and concurrency protection.

## What's changed

- Removed admin credentials from the login page and customer-facing UI.
- Added email validation and strong-password checks.
- Passwords are stored as salted PBKDF2-derived hashes in the browser rather than plain text.
- Added authenticated sessions and role-based route guards.
- Added short-lived event caching with invalidation when event inventory changes.
- Added a browser-level booking lock plus cross-tab `BroadcastChannel` inventory notifications.
- Revalidates seats immediately before booking confirmation to reduce double-booking.
- Replaced the old payment form with:
  1. Order review
  2. TicketBook Pay gateway screen
  3. UPI/Card/Net Banking demo selection
  4. Payment reference generation
  5. Ticket creation
- Added richer digital tickets with ticket class, gate, payment reference, QR-style code and barcode.
- Added search across title, teams, artists, venues and descriptions.
- Added category, city, price and sort filters.
- Added a more responsive, sharper visual system with a dark base and gold/teal/pink accents.
- Added 60+ October 2026 event listings based on current published event/fixture information.

## Important security limitation

This is still a **front-end-only student project**. Browser Local Storage cannot provide production-grade authentication, authorization, inventory locking or payment security. The PBKDF2 implementation, session checks, cache, lock and gateway are appropriate as a demonstration of the architecture, but a real deployment should move users, sessions, inventory, locks and payments to a server/database and use a PCI-compliant payment provider.

The included payment gateway is a **demo gateway** and does not charge a real card or UPI account.

## Project structure

```text
ticket-booking/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── data.js
│   ├── nav.js
│   ├── auth.js
│   ├── user.js
│   └── admin.js
├── user/
│   ├── dashboard.html
│   ├── event.html
│   ├── payment.html
│   ├── gateway.html
│   ├── ticket.html
│   └── my-tickets.html
└── admin/
    ├── dashboard.html
    ├── events.html
    ├── bookings.html
    └── promotions.html
```

## Run locally

```bash
cd ticket-booking
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Event data

The October 2026 seed catalogue includes current published fixtures and event listings from sources such as BookMyShow, Indian Express, Cricbuzz/cricket schedule listings, Mirchi and current event pages. The application marks seeded records as `sourceVerified: true` so the UI can distinguish the curated October catalogue.

Because live event schedules, venues and ticket availability can change, this project should be refreshed before being used as a real ticket marketplace.

## Demo flow

1. Create a customer account.
2. Use a strong password satisfying all five checks.
3. Browse 60+ October listings.
4. Search by event, team, artist or venue.
5. Filter by category, city and price.
6. Open an event and select up to eight seats.
7. Apply a promotion if desired.
8. Review the order.
9. Continue to the TicketBook Pay demo gateway.
10. Choose UPI, Card or Net Banking.
11. Confirm the payment demo.
12. Receive a dynamic digital ticket.
13. Open **My Tickets** to revisit it.
14. The admin module can still manage events, bookings and promotions.

## Demo promotion codes

- `WELCOME10`
- `FEST20`
- `OCTOBER15`

## Notes for a production version

For a real system, replace the Local Storage layer with:

- Backend authentication with secure password hashing such as Argon2id/bcrypt.
- HttpOnly, Secure, SameSite session cookies.
- Database transactions for seat reservation.
- Redis or database-backed distributed locks where appropriate.
- Server-side inventory validation.
- Rate limiting and login-attempt protection.
- CSRF protection where cookie authentication is used.
- A real payment provider such as Razorpay/Stripe using server-created payment orders.
- Webhook verification before marking a booking as paid.
- Server-generated signed ticket/QR credentials.
- HTTPS and secure secrets management.
