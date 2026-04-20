# VapoStant - Client (PWA Management System)

VapoStant is a premium, mobile-first management system designed to control distributed stock across multiple branches or "stantes".

## Features

- **Modern PWA Experience**: Installable on iOS and Android with a native-app feel (no browser bars, support for iPhone notch).
- **Multi-Branch Dashboard**: Real-time tracking of inventory and sales across different physical locations.
- **Exportable Reports**: Generate professional sales and stock reports in **PNG** and **PDF** directly from your device.
- **Privacy Controls**: Toggle earning/profit visibility on generated reports before sharing.
- **Advanced Analytics**: Filter sales global or by branch with daily, weekly, and monthly views.
- **Premium UI**: Dark mode with Glassmorphism, smooth animations, and optimized for mobile touch interaction.

## Tech Stack

- **Frontend**: React (Vite)
- **Styling**: Vanilla CSS (Custom Design System)
- **Icons**: Lucide-React
- **Exporting**: html2canvas & jsPDF
- **Networking**: Axios

## Getting Started

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your `VITE_API_URL`.
4. Run the development server:
   ```bash
   npm run dev
   ```

## Installation

This is a Progressive Web App. Open it in your mobile browser and select **"Add to Home Screen"** (iOS) or **"Install"** (Android) to use it as a native application.
