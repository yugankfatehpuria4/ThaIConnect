<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/ThalAI-Connect-red.svg?style=for-the-badge" alt="Brand" />
  <br>
  <h1>🩸 ThalAI Connect</h1>
  <p><b>An AI-Powered Life Saving Platform for Thalassemia Patients & Blood Donors</b></p>
</div>

<br/>

ThalAI Connect bridges the gap between thalassemia patients requiring regular and emergency blood transfusions and willing donors. Built with a modern microservices architecture, it integrates machine learning, real-time tracking, and immediate SOS coordination to save lives when every second counts.

## 🌟 Key Features

- **🤖 Smart AI Matching**: Ranks donors based on blood compatibility, location distance, past donation frequency, and historical response rates to ensure exactly the right match.
- **🚨 Instant Emergency SOS Alerts**: Real-time WebSockets integration allows patients to blast urgent SOS alerts to all nearby compatible donors. Donors receive an instant notification in-app.
- **💬 AI Health & Wellness Assistant**: An integrated AI chatbot (powered by LLMs) providing personalized thalassemia guidance, general wellness reminders, data extraction, and empathetic support.
- **📊 Interactive Dashboards**: Dedicated robust workspaces for **Patients** (scheduling, matching), **Donors** (donation history tracking, achievements, leaderboards), and **Admins** (system-wide SOS monitoring, metric overviews).
- **🔮 Real-World Predictive ML Engine**: Custom Python inference service analyzing physical health metrics like Hemoglobin (Hb), Ferritin, and biological cycles to forecast impending transfusion dates precisely.

---

## 🏗️ Technical Architecture

The platform runs on a fully decoupled tri-service architecture combining the cutting edge of web performance and AI.

### 1. Frontend Web App
- **Framework**: `Next.js 15` (React)
- **Styling**: `Tailwind CSS`, Framer Motion for micro-interactions
- **Real-Time Integration**: `Socket.io-client` for immediate SOS triggers and acceptance.

### 2. Node Backend
- **Framework**: `Express.js` (TypeScript execution via `ts-node`)
- **Database**: `MongoDB` with `Mongoose` ORM
- **Authentication**: Custom JWT-based Authentication
- **Sockets**: `Socket.io` handling parallel real-time geospatial matches and SOS distribution instances.

### 3. AI Predictive Inference Service
- **Framework**: Python `Flask` API
- Handles ML data-building paths and complex statistical predictive inference isolated from the main Express loop.

---

## 🚀 Getting Started

### Prerequisites

You will need the following installed:
- Node.js (v18 or higher recommended)
- Python (v3.9 or higher)
- A MongoDB URI instance (Atlas recommended)

### 1. Database Setup

Configure the `.env` variables located within `/backend` and `/frontend`. Core variables include your DB string:

```env
# backend/.env 
MONGO_URI=mongodb+srv://<auth>@<cluster>.mongodb.net/...
JWT_SECRET=your_jwt_signing_key
PORT=5002

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5002/api
```

### 2. Booting up Backend (Express)
```bash
cd backend
npm install
npm run dev
```

### 3. Booting up AI Service (Flask)
```bash
cd ai-service
python -m venv .venv

# MacOS / Linux:
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

pip install -r requirements.txt
python app.py
```

### 4. Booting up Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev 
```

Navigate to `http://localhost:3010` in your browser.

---

## 💻 Usage & Demonstration Context

By visiting the home page, you will spot an **Emergency SOS** trigger. Selecting it will bring down a live simulation.

1. **Creating an account**: Jump to the register menu and designate yourself as a Donor, Patient, or Admin. 
2. As a **Donor**, navigate your customized metrics dashboard to download CSVs/PDFs of your contribution to the world, and earn distinct achievement badges. Let the app sit in the background; you will be notified on the spot if a matching SOS broadcasts nearby.
3. As a **Patient**, actively book "appointments" with matching donors natively via the portal, track transfusion cycles spanning back entirely.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Made with ❤️ for a mission to save lives</p>
