# Vita Call Dashboard

**“Create a CRM web application named Vita Call for call-center order management.
Do NOT include subscription plans — all access is internal only.
Only Admin users are created manually from the backend (no public signup).

Build with:

React + Next.js + TailwindCSS

Node.js / Supabase / PostgreSQL backend

Clean UI similar to Shopify / Stripe dashboards

Dark sidebar with orange accents (brand: Vita Call)

User Roles:

Admin → full access, creates agents

Agent → can only see assigned orders + add notes + change allowed statuses

Main Modules:

1. Dashboard

Show counters for order statuses: Pending, Take, Call Again, Confirmed, Shipped, Returned, Paid, Trashed, Cancelled

Filters: Today, Yesterday, Last 7 Days, Custom range

Small chart: Orders per day

Show total assigned orders per agent

2. Orders

Order table with search & filters (status, agent, product, date)

Columns: Status badge, Order ID, Product, Price, Assigned agent, Date

Actions: View Order, Assign Agent, Change Status

Pagination

Export to CSV

3. Order Status Pipeline

Create full workflow:
Pending → Take → Call Again → Confirmed → Shipped → Returned → Paid → Trashed → Cancelled

Agents can only update: Pending → Take → Call Again → Confirmed

Admin can update any status

Add status dropdown inside order details

4. Assign Agent

Modal with agent list

When assigned: save log in order history

Assigned orders appear in the Agent’s “Assigned to Me” tab

5. Order Details Page

Customer info (name, phone, city, address, postal code)

Product list

Status timeline

Internal notes (agent comments)

Show who assigned the order & when

Add next action reminders

6. Users Module (Admin only)

Create users manually (name, email, role, password)

Deactivate/activate users

Show stats: total processed orders, last login

7. Products Module

Product name

Description

Price

Photo (optional)

Disable/enable product

8. Permissions

Admin: all pages

Agent: only Assigned to Me + My Stats

Protect routes in both frontend & backend

9. UI/Branding

Name: Vita Call

Top-left logo placeholder

Orange highlights (#f57c00)

Clean, fast, minimal layout

Generate all pages, API routes, DB schema, and reusable components.”**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vita-call-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/28bc8c00-6732-4b7d-b5cb-11920fe59227).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
