Tengacion
The Social OS for the Next Billion People 🌍
Tengacion is a modern, full-stack social platform built to connect people through stories, posts, real-time messaging, and rich media — designed from the ground up for speed, scale, and simplicity.

This platform is the parent ecosystem that powers PyrexxBook, real-time chat, and future Tengacion products.

🚀 What is Tengacion?
Tengacion is not just another social app.

It is a Social Operating System — a foundation upon which:

Social networks

Messaging platforms

Digital identity

Media sharing

AI and payments
can all live together in one unified ecosystem.

🧩 Core Features
🧑‍🤝‍🧑 Social Network
User profiles

Follow & followers

Posts with images

Likes and comments

📸 Stories
24-hour disappearing stories

Image-based sharing

Viewer tracking (planned)

💬 Real-time Messaging
Socket.io powered chat

Online / offline status

Live message delivery

🔐 Authentication
Secure login & registration

JWT-based sessions

Password encryption with bcrypt

🛠 Tech Stack
Frontend
React

Vite

CSS

Socket.io client

Backend
Node.js

Express

MongoDB

Mongoose

JWT Authentication

Socket.io

📂 Project Structure
pgsql
Copy code
Tengacion/
├── backend/
│   ├── server.js
│   ├── models/
│   ├── routes/
│   └── uploads/
├── frontend/
│   ├── src/
│   └── index.html
├── .env
├── package.json
└── README.md

⚙️ Running Tengacion Locally
1️⃣ Install dependencies
bash
Copy code
npm install
2️⃣ Create a .env file
env
Copy code
MONGO_URI=mongodb://127.0.0.1:27017/tengacion
JWT_SECRET=your_secret_key
3️⃣ Start the platform
bash
Copy code
npm run dev
You should see:

arduino
Copy code
🚀 Tengacion running...
Frontend and backend will start together.

🧪 Development Philosophy
Tengacion is built with:

Modularity — each feature is its own system

Scalability — ready for millions of users

Real-time first — live updates everywhere

Security by default

🌍 Vision
Tengacion aims to become a global social infrastructure, similar to what:

Meta is to Facebook

Alphabet is to Google

PyrexxBook is only the beginning.

👤 Founder
Stephen Daniel Kurah (Pyrexx)
Founder & Lead Engineer
Nigeria 🇳🇬

📜 License
ISC

SEO notes
- `robots.txt` should be available at `https://tengacion.com/robots.txt`.
- `sitemap.xml` should be available at `https://tengacion.com/sitemap.xml` and acts as the sitemap index for child sitemaps under `/sitemaps/*.xml`.
- Set `VITE_GA_MEASUREMENT_ID` before building the frontend if you want GA4 pageview tracking in production.
- Prefer DNS verification for Google Search Console. If you use an HTML verification tag instead, add it in [index.html](/c:/Users/LENOVO/Tengacion/frontend/index.html).
- Submit the sitemap index URL above in Search Console or Bing Webmaster Tools after deployment.
