# 🎯 AI Job Tracker

A private, self-hosted job application tracker with AI superpowers.
Built with Next.js, Zustand, and Google Gemini.

## ✨ Features

- **KANBAN BOARD**: Drag-and-drop board to track applications (Wishlist -> Applied -> Interview -> Offer).
- **CHROME EXTENSION**: Save jobs from any website with one click.
- **AI RESUME TAILOR**: Auto-generate cover letters and custom resume bullets for any job description.
- **LOCAL & PRIVATE**: All data is stored locally on your machine. No cloud necessary.
- **SECURE ACCESS**: Protected by a customizable PIN.

## 🚀 Getting Started

### 1. Run the App
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 2. Install the Extension
1. Go to `chrome://extensions`.
2. Enable "Developer Mode" (top right).
3. Click "Load Unpacked".
4. Select the `src/extension` folder inside this project.

### 3. Usage
- **Add Jobs**: Use the extension ("Save Job") or click "+ New Job" in the app.
- **Track**: Drag cards across columns as you progress.
- **Tailor**: Go to "AI Tailor", upload your Resume text, and paste a Job Description to get AI advice.

## 🛠 Configuration

- **PIN Code**: Currently hardcoded as `1234` in `src/app/login/page.js`.
- **Gemini API**: Add your API key to `.env.local` as `GEMINI_API_KEY`.
