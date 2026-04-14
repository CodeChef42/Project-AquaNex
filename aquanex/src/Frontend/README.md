# AquaNex Frontend

The AquaNex Frontend is a powerful, React-based dashboard designed for real-time monitoring and management of smart irrigation systems. It provides a highly interactive user experience for visualizing complex IoT data and managing agricultural workspaces.

## 🛠 Tech Stack

-   **Framework:** [React 18](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool:** [Vite](https://vitejs.dev/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components:** [Shadcn UI](https://ui.shadcn.com/) (built on Radix UI)
-   **Maps:** [Leaflet](https://leafletjs.com/) & [React Leaflet](https://react-leaflet.js.org/)
-   **Charts:** [Recharts](https://recharts.org/)
-   **State Management:** React Context (Auth, Simulation) & [TanStack Query](https://tanstack.com/query/latest)
-   **Forms:** React Hook Form with Zod validation
-   **Icons:** Lucide React

---

## 🌟 Key Modules & Pages

-   **Dashboard (`Home.tsx`):** Overview of workspace health, active incidents, and core metrics.
-   **Maps:**
    -   **Global View:** High-level view of all managed workspaces.
    -   **Pipeline View:** Detailed map of pipe sections, sensors, and real-time flow/pressure status.
-   **Monitoring:**
    -   **Water Quality:** Real-time analysis of pH, TDS, and other water parameters.
    -   **Soil Salinity:** Monitoring of soil health and moisture levels.
-   **Analytics:**
    -   **Demand Forecasting:** Visualization of predicted vs. actual water usage.
    -   **Incident Analytics:** Historical analysis of system failures and recovery times.
-   **Management:**
    -   **Workspaces:** Creating and configuring new agricultural sites.
    -   **Settings:** Comprehensive user profile and workspace configuration, including member invites and device mapping.

---

## 🔐 Authentication Flow

The frontend uses a secure JWT-based flow managed through `AuthContext.tsx`:
1.  **Login:** Users authenticate via username/password or Google OAuth.
2.  **Tokens:** Access and Refresh tokens are stored in `localStorage`.
3.  **Interceptors:** Axios interceptors (`lib/api.ts`) automatically attach the JWT to outgoing requests and handle token refreshing on 401 errors.
4.  **Protected Routes:** Component-level guards ensure only authenticated users can access the dashboard.

---

## 🚀 Getting Started

### Environment Variables
Create a `.env` file in this directory:
```env
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

## 📂 Project Structure
-   `src/components`: Reusable UI components (Shadcn UI and custom components like `GlobalMapView`).
-   `src/contexts`: Global state management (Auth, Simulation).
-   `src/hooks`: Custom React hooks for API calls and UI logic.
-   `src/lib`: API configuration and utility functions.
-   `src/pages`: Top-level page components and onboarding flows.
-   `src/styles`: Global CSS and Tailwind configurations.
