# Career Guidance AI - Frontend

Modern, responsive frontend for the AI-powered resume parsing and career guidance platform.

## Design Inspiration

Inspired by x.ai's clean, modern design principles:
- Dark theme with gradient accents
- Smooth animations and transitions
- Clear call-to-actions
- Responsive grid layouts
- Focus on user experience

## Features

- **Modern UI/UX**: Built with React and Tailwind CSS
- **Smooth Animations**: Powered by Framer Motion
- **Drag & Drop Upload**: Intuitive file upload interface
- **Real-time Analysis**: Live status updates during parsing
- **Responsive Design**: Works on all devices
- **Results Dashboard**: Comprehensive visualization of parsed data

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library
- **Axios**: HTTP client for API calls
- **Lucide React**: Beautiful icon library
- **React Router**: Client-side routing

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The dev server runs on `http://localhost:3000` with hot module replacement.

API requests to `/api/*` are automatically proxied to `http://localhost:8000`.

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx
│   │   ├── Features.jsx
│   │   ├── UploadSection.jsx
│   │   └── Footer.jsx
│   ├── pages/          # Page components
│   │   └── ResultsPage.jsx
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.js      # Vite configuration
├── tailwind.config.js  # Tailwind configuration
└── package.json        # Dependencies
```

## Key Components

### Hero Section
- Animated gradient background
- Call-to-action buttons
- Statistics display
- Smooth scroll indicator

### Upload Section
- Drag & drop file upload
- File validation (PDF, DOCX, TXT)
- Optional metadata form (JEE rank, location, preferences)
- Real-time upload and parsing status

### Results Page
- Personal information card
- Education timeline
- Skills visualization
- Experience and projects display
- Confidence score meter
- Export functionality

## Customization

### Colors

Edit `tailwind.config.js` to customize the color scheme:

```js
colors: {
  primary: { /* your colors */ },
  dark: { /* your colors */ }
}
```

### Animations

Modify animations in `tailwind.config.js` under `theme.extend.animation`.

## API Integration

The frontend expects these API endpoints:

- `POST /api/upload` - Upload resume file
- `POST /api/parse/{applicant_id}` - Parse uploaded resume
- `GET /api/results/{applicant_id}` - Fetch analysis results

## Environment Variables

Create a `.env` file if needed:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory, ready for deployment.

## License

Private project for internal use.
