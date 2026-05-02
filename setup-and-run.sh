#!/bin/bash

# Setup and Run Script for Goal-Setting Feature
# This script prepares the environment and starts the dev server

echo "🚀 Setting up Guided Goal-Setting Onboarding Feature..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🔍 Checking files..."

# Verify new component exists
if [ -f "src/components/GoalSetting.jsx" ]; then
    echo "✅ GoalSetting.jsx created"
else
    echo "❌ GoalSetting.jsx not found"
    exit 1
fi

# Check if App.jsx is updated
if grep -q "GoalSetting" src/App.jsx; then
    echo "✅ App.jsx updated with routing"
else
    echo "❌ App.jsx not properly updated"
    exit 1
fi

# Check if Dashboard accepts props
if grep -q "initialGoal\|initialRisk" src/components/Dashboard.jsx; then
    echo "✅ Dashboard.jsx updated with props"
else
    echo "❌ Dashboard.jsx not properly updated"
    exit 1
fi

echo ""
echo "🎯 Feature Summary:"
echo "   • 6 responsive goal cards with emojis"
echo "   • Risk appetite selector (Low/Medium/High)"
echo "   • localStorage persistence"
echo "   • Smooth transitions and hover effects"
echo "   • Mobile-first responsive design"
echo "   • Green checkmark on selected goal"
echo "   • Blue highlight on selected risk"

echo ""
echo "🌐 Starting development server..."
echo "   The app will be available at http://localhost:5173"
echo ""
echo "📍 Flow:"
echo "   1. Login → presented with goal selection"
echo "   2. Select a goal + risk appetite"
echo "   3. Click 'Continue to Dashboard'"
echo "   4. Dashboard loads with personalized recommendations"
echo ""

npm start
