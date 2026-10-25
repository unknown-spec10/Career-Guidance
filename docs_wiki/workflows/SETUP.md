# Frontend Setup Instructions

## Quick Start

```powershell
# Navigate to frontend directory
cd "D:\Career Guidence\frontend"

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## What's Included

✨ **Modern UI Components**
- Hero section with animated gradients
- Feature cards with hover effects
- Drag & drop file upload
- Results dashboard with data visualization
- Responsive navigation

🎨 **Design Features**
- Dark theme inspired by x.ai
- Smooth animations (Framer Motion)
- Gradient accents
- Custom color scheme
- Mobile-responsive

🚀 **Technical Features**
- React 18 + Vite (fast HMR)
- Tailwind CSS (utility-first)
- React Router (SPA routing)
- Axios (API integration)
- Lucide React (beautiful icons)

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx        # Navigation bar
│   │   ├── Hero.jsx          # Landing hero section
│   │   ├── Features.jsx      # Feature grid
│   │   ├── UploadSection.jsx # File upload form
│   │   └── Footer.jsx        # Footer component
│   ├── pages/
│   │   └── ResultsPage.jsx   # Analysis results display
│   ├── App.jsx               # Main app with routing
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
├── public/                   # Static assets
├── index.html                # HTML template
└── package.json              # Dependencies
```

## API Integration

The frontend connects to your FastAPI backend at `http://localhost:8000`

Endpoints used:
- `POST /upload` (also `POST /api/upload/resume`) - Upload resume with metadata
- `POST /parse/{applicant_id}` - Trigger the offline rule-based parse
- `GET /api/applicant/{applicant_id}` - Fetch parsed profile and scorecard

## Customization

### Colors
Edit `tailwind.config.js` to change the color scheme.

### Content
Update text in component files:
- `Hero.jsx` - Main headline and CTA
- `Features.jsx` - Feature descriptions
- `Footer.jsx` - Contact information

## Building for Production

```powershell
npm run build
```

Output will be in `dist/` directory.

## Next Steps

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Ensure backend is running on port 8000
4. Open `http://localhost:3000` in browser
5. Upload a resume and see the magic! ✨
