# VeinReach - Blood Donation & Emergency Blood Request Platform

## Mission

Build a production-grade blood donation platform that connects blood donors, recipients, hospitals, and blood banks through location-based matching, real-time notifications, and intelligent donor discovery.

The platform must prioritize:

* Speed during emergencies
* User safety
* Data privacy
* Donor eligibility validation
* Scalability
* Accessibility

---

# Tech Stack

## Frontend

* React
* React Router
* Tailwind CSS
* React Query / TanStack Query
* Socket.io Client
* Leaflet or Google Maps
* React Hook Form
* Zod Validation

## Backend

* Node.js
* Express.js
* Socket.io
* JWT Authentication
* bcrypt

## Database

* MongoDB Atlas
* Mongoose ODM

## Storage

* Cloudflare R2

Store:

* Profile Images
* Verification Documents
* Hospital Documents
* Donation Certificates

Do NOT store application data in R2.

## Notifications

* Firebase Cloud Messaging (FCM)
* Nodemailer

## Caching & Queues

* Redis

## Deployment

Frontend:

* Vercel

Backend:

* Render / Railway

Database:

* MongoDB Atlas

Storage:

* Cloudflare R2

---

# Core User Types

## Donor

Can:

* Register
* Update availability
* Accept requests
* Donate blood
* Track donation history

## Recipient

Can:

* Create blood requests
* Search donors
* Accept donor offers
* Track request status

## Hospital

Can:

* Create emergency requests
* Verify fulfilled donations
* Manage organization profile

## Blood Bank

Can:

* Publish stock shortages
* Publish stock availability

## Admin

Can:

* Manage platform
* Review reports
* Moderate abuse
* Verify organizations

---

# User Registration

Required Fields

* Full Name
* Email
* Mobile Number
* Password
* Blood Group
* Gender
* Date of Birth
* Weight
* City
* State
* Emergency Contact

Location

Store:

* Latitude
* Longitude

Use GeoJSON:

{
location: {
type: "Point",
coordinates: [longitude, latitude]
}
}

Create MongoDB 2dsphere index.

---

# Authentication

Implement:

* JWT Access Token
* Refresh Token
* Email Verification
* Mobile OTP Verification

Future:

* Google Login

---

# Blood Groups

Supported:

* A+
* A-
* B+
* B-
* AB+
* AB-
* O+
* O-

---

# Blood Compatibility Engine

The platform must automatically:

* Match compatible donors
* Exclude incompatible donors
* Sort donors by compatibility

Priority:

1. Exact Match
2. Compatible Match
3. Distance
4. Availability
5. Reputation Score

---

# Donor Eligibility Validation

A donor cannot accept a request if:

* Under minimum age
* Under weight requirement
* Marked unavailable
* Suspended
* Donation cooldown not completed

Donation Cooldown:

Male:

* Minimum 90 days

Female:

* Minimum 120 days

System must calculate eligibility automatically.

---

# Donor Profile

Store:

* Blood Group
* Availability
* Last Donation Date
* Donation Count
* Reputation Score
* Verification Status
* Preferred Donation Radius

Statuses:

* Available
* Busy
* Offline
* Temporarily Ineligible

---

# Recipient Requests

Fields:

* Blood Group Needed
* Units Required
* Hospital Name
* Hospital Address
* Hospital Coordinates
* Urgency Level
* Notes

Urgency Levels:

* Critical
* Urgent
* Normal

Statuses:

* Active
* Accepted
* In Progress
* Fulfilled
* Expired
* Cancelled

---

# Real-Time Donor Radar

Display:

* Available Donors
* Compatible Donors
* Donor Density
* Distance Groups

Examples:

Within 2 km:

* 5 donors

Within 5 km:

* 18 donors

Within 10 km:

* 42 donors

Update via Socket.io in real time.

---

# Smart Location Matching

Default Search Radius:

* 5 km
* 10 km
* 20 km
* 50 km

Use MongoDB geospatial queries.

Sort by:

1. Compatibility
2. Distance
3. Reputation
4. Availability

---

# Notification Engine

When a blood request is created:

Notify:

* Compatible donors
* Nearby hospitals

Channels:

* Push Notification
* Email Notification
* In-App Notification

Future:

* SMS Notification

---

# Emergency Broadcast System

For Critical requests:

Broadcast to:

* Compatible donors
* Hospitals

Within configurable radius.

Default:

20 km

Escalate:

20 km → 50 km → 100 km

if request remains unfulfilled.

---

# Donation Marketplace

Donors may publish:

* Available blood group
* Availability window
* Donation radius

Recipients may discover donors directly.

---

# Health Information Display

Visible before acceptance:

* Blood Group
* Age
* Weight Range
* Last Donation Date
* Donation Count
* Eligibility Status

Never expose:

* Medical reports
* Personal health records
* Sensitive information

---

# In-App Chat

Features:

* Real-time messaging
* Read receipts
* Delivery status
* File sharing

Hide personal phone numbers until:

* Request accepted
  OR
* Both parties consent

---

# Reputation System

Increase score when:

* Successful donation
* Verified donation
* Positive feedback

Decrease score when:

* Spam requests
* Fake accounts
* No-show behavior

Badges:

* First Donation
* Lifesaver
* Hero Donor
* Community Champion

---

# Donation History

Track:

* Donations Made
* Donations Received
* Date
* Hospital
* Verification Status

Generate:

* Donation Certificates

Store certificates in Cloudflare R2.

---

# Hospital Portal

Hospitals can:

* Create emergency requests
* Verify donations
* View nearby donors
* Access analytics

Require document verification.

---

# Blood Bank Portal

Features:

* Publish shortages
* Publish stock availability
* Emergency alerts

Require verification.

---

# Admin Dashboard

Manage:

* Users
* Hospitals
* Blood Banks
* Requests
* Reports

View:

* Active Requests
* Donation Statistics
* Donor Growth
* Fulfillment Rates

---

# Analytics Dashboard

Track:

* Total Donations
* Active Donors
* Emergency Requests
* Fulfillment Rate
* Average Response Time
* Most Needed Blood Types

---

# Security Requirements

Mandatory:

* JWT Authentication
* Refresh Tokens
* bcrypt Password Hashing
* Rate Limiting
* Input Validation
* Helmet
* CORS
* XSS Protection
* CSRF Protection
* Audit Logging

Never expose:

* Exact user coordinates
* Sensitive health records
* Passwords
* Internal IDs

---

# Real-Time Features

Use Socket.io for:

* Live donor count
* New requests
* Request updates
* Chat messages
* Notification delivery
* Donor availability updates

---

# Redis Usage

Use Redis for:

* Notification queues
* Rate limiting
* Presence tracking
* Online user tracking
* Cached donor counts

---

# API Design Rules

Use REST APIs.

Versioning:

/api/v1

Response format:

{
success: true,
data: {},
message: ""
}

Use centralized error handling.

---

# Frontend Rules

Use:

* Functional Components
* Hooks
* Reusable UI Components
* Feature-Based Folder Structure

Avoid:

* Large Components
* Business Logic in UI

---

# Backend Rules

Architecture:

Controller
→ Service
→ Repository
→ Database

Never place business logic inside controllers.

---

# Accessibility

Support:

* Keyboard Navigation
* Screen Readers
* High Contrast Mode

WCAG compliance preferred.

---

# Future Enhancements

* Android App
* iOS App
* AI Donor Recommendation Engine
* Multi-language Support
* Voice-Based Emergency Requests
* WhatsApp Notifications
* Predictive Blood Shortage Analytics
* Disaster Response Mode
* National Blood Network Integration

---

# Definition of Success

A recipient should be able to:

1. Register in under 2 minutes.
2. Create a blood request in under 60 seconds.
3. See nearby compatible donors instantly.
4. Notify donors automatically.
5. Track request status in real time.
6. Communicate securely.
7. Receive blood assistance as quickly as possible.
