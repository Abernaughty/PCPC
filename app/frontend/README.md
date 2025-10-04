# PCPC Frontend Application

## Overview

Svelte frontend application for the Pokemon Card Price Checker (PCPC) system.

## Technology Stack

- **Framework**: Svelte
- **Build Tool**: Rollup
- **Hosting**: Azure Static Web Apps
- **Package Manager**: npm

## Development Setup

### Prerequisites

- Node.js 22.19.0 LTS
- npm

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── services/       # Business logic services
├── stores/         # Svelte stores
├── data/           # Static data and configuration
├── debug/          # Debug tools and panels
├── utils/          # Utility functions
├── App.svelte      # Main application component
└── main.js         # Application entry point

public/
├── images/         # Static image assets
├── global.css      # Global styles
├── index.html      # HTML entry point
└── staticwebapp.config.json  # Azure Static Web App configuration
```

## Migration Notes

This frontend application was migrated from the original PokeData project as part of the PCPC enterprise repository consolidation.

Original source: `C:\Users\maber\Documents\GitHub\PokeData`
Migration date: September 22, 2025
