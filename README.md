# TreeWalley Furniture - Amazon-like Commerce App

A full-featured TreeWalley furniture buying platform demo with end-to-end working flows.

## Features implemented

- **Product Catalog System**
  - Category listing (Beds, Sofa, Cabinet, Dining)
  - Search + filters (price, material, size)
  - Product detail API with similar/recommended products
  - Multiple images, description and specs
  - Stock management on order/payment

- **Customer Account Features**
  - Signup + login (password)
  - OTP login flow
  - Save addresses
  - Wishlist
  - Cart + checkout
  - Order history

- **Payment System**
  - Mock gateway integrations: Razorpay / PayU / Cashfree
  - Modes: UPI / Card / NetBanking / COD
  - OTP verification for prepaid payment

- **Order & Logistics**
  - Order placement
  - Invoice number generation
  - Tracking timeline (Shiprocket/Delhivery mock)
  - Return/replacement request handling

- **Trust Features**
  - Ratings and reviews
  - FAQ API
  - Policies: return, warranty, privacy, terms, GST

- **Admin Dashboard**
  - Sales stats/revenue
  - Customer list
  - Order management endpoint
  - Add/edit products

- **Search & Experience**
  - Search bar + filters + sorting
  - Mobile responsive UI
  - Similar/recommended products API

- **Marketing Tools**
  - Coupon validation
  - Email/WhatsApp notification mock
  - SEO metadata endpoint
  - Ads tracking pixel endpoint

- **Legal & Compliance**
  - GST statement in invoice response
  - Privacy/terms/returns pages via content API

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`

## Test

```bash
npm test
```

## Notes

- OTPs are returned as `demoOtp` for dev/testing (no external SMS provider required).
- Payment and shipping integrations are mocked but fully wired in backend workflows.
