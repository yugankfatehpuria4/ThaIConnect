<div align="center">

# 🩸 ThalAI Connect

### **AI-Powered Real-Time Blood Donation & Patient Support Platform**

<p>
  <img src="https://img.shields.io/badge/Status-Production_Ready-success?style=flat-square"/>
  <img src="https://img.shields.io/badge/Stack-Full--Stack-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/AI-Enabled-critical?style=flat-square"/>
  <img src="https://img.shields.io/badge/Architecture-Microservices-purple?style=flat-square"/>
</p>

> **Find the right donor. Predict health risks. Respond instantly.**

---

🔗 **Live Demo** · *(Add your link)*
📂 **Repository** · https://github.com/yugankfatehpuria4/ThaIConnect

</div>

---

## ⚡ What is ThalAI Connect?

ThalAI Connect is a **real-time healthcare platform** designed to solve one critical problem:

> **Finding blood — fast, reliably, and intelligently.**

It connects **patients, donors, and administrators** through a system that combines:

* ⚡ Real-time communication
* 🤖 AI-powered assistance
* 📊 Machine learning insights

---

## 🚨 Why This Matters

For thalassemia patients, **blood is not optional — it’s survival**.

But in real-world situations:

* Donors are hard to find quickly
* Emergency response is slow
* There is no predictive system for transfusions

👉 ThalAI Connect transforms this into a **data-driven, real-time ecosystem**.

---

## 🌟 Core Features

### 🚨 Real-Time SOS Engine

* Instant emergency alerts via WebSockets
* Parallel donor notifications
* First-accept response handling

---

### 🤝 Smart Donor Matching

* Blood group compatibility
* Distance-based filtering
* Availability + donation history
* Priority-based ranking

---

### 📊 Predictive Health Insights

* Hemoglobin trend estimation
* Risk level detection
* Transfusion cycle prediction

---

### 💬 AI Assistant

* Patient guidance & awareness
* Health-related Q&A
* Context-based responses

---

### 🧑‍⚕️ Multi-Dashboard System

* **Patient** → Search donors, track health
* **Donor** → Manage availability, history
* **Admin** → Monitor system activity

---

## 🧠 How It Works

```text
Patient triggers SOS
        ↓
Backend finds best donors
        ↓
Socket.io sends real-time alerts
        ↓
Donor accepts request
        ↓
System locks response
        ↓
Patient gets confirmation
```

---

## 🛠️ Tech Stack

| Layer     | Technology                           |
| --------- | ------------------------------------ |
| Frontend  | Next.js (React), Tailwind CSS        |
| Backend   | Node.js, Express                     |
| Database  | MongoDB + Mongoose                   |
| Real-Time | Socket.io                            |
| AI / ML   | Python, Flask, Scikit-learn, XGBoost |

---

## 📊 Machine Learning Module

The ML system provides **basic clinical decision support**:

* Uses:

  * Hemoglobin (Hb)
  * Platelets
  * CBC parameters

* Predicts:

  * Hb trends
  * Risk level
  * Transfusion timing

* Built using:

  * Scikit-learn
  * XGBoost

---

## 📸 Screenshots

> Add real screenshots here (VERY IMPORTANT)

| Patient                 | Donor                 | SOS                 |
| ----------------------- | --------------------- | ------------------- |
| ![](public/patient.png) | ![](public/donor.png) | ![](public/sos.png) |

---

## 🚀 Getting Started

### 🔧 Requirements

* Node.js (v18+)
* Python (v3.9+)
* MongoDB

---

### ⚙️ Setup

```bash
git clone https://github.com/yugankfatehpuria4/ThaIConnect.git
cd ThaIConnect
```

---

### ▶️ Backend

```bash
cd backend
npm install
npm run dev
```

---

### 🤖 ML Service

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

---

### 🌐 Frontend

```bash
cd frontend
npm install
npm run dev
```

Open → `http://localhost:3010`

---

## 💡 Usage

* Register as Patient / Donor / Admin
* Patients → trigger SOS, find donors
* Donors → receive alerts, respond
* Admin → monitor activity

---

## 🗺️ Roadmap

* 📍 Google Maps donor tracking
* 📲 WhatsApp/SMS alerts
* 📄 Medical report analysis (OCR)
* 🧠 Advanced ML models
* ☁️ Cloud deployment

---

## 🤝 Author

Built by **Yugank Fatehpuria**
Focused on building impactful real-world systems 🚀

---

<div align="center">

**Made with ❤️ to save lives**

</div>
