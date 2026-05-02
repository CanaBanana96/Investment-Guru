# Investment Guru - Launch Guide

## Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)
- Git

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/CanaBanana96/Investment-Guru.git
cd Investment-Guru
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm start
```

### 4. Access the Application
Open your browser and navigate to: `http://localhost:5173`

## Alternative: Use the Setup Script
If you prefer, you can use the provided setup script which handles dependency installation and verification:

```bash
./setup-and-run.sh
```

## Troubleshooting
- If port 5173 is in use, the server will prompt you to use a different port
- Ensure all dependencies are installed by running `npm install` if you encounter errors
- Check that Node.js and npm are properly installed by running `node --version` and `npm --version`

## Build for Production
```bash
npm run build
npm run preview
```