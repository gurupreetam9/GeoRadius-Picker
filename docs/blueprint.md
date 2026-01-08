# **App Name**: GeoRadius Picker

## Core Features:

- Interactive Map Display: Display an interactive map (Google Maps or Mapbox) with a draggable radius circle for location and radius selection.
- Radius Adjustment: Allow users to adjust the radius via drag handles on the circle and/or a numeric input field.
- Real-time Radius Update: Visually update the radius circle in real-time as the center point or radius changes.
- Location Confirmation & Data Return: Provide a 'Confirm Location' button to return latitude, longitude, and radius (in meters).
- Android App Deep Linking: Redirect back to the Android app using a deep link (myapp://location-picker?lat=12.9716&lng=77.5946&radius=600) after location confirmation.
- Fallback Web Display: If the app is not installed, show the selected values on-screen with an option to copy them manually.
- Geocode tool: Accept user-entered addresses via a text input, forward those requests to a geocoding API like the Google Maps API, and display the matching latitude and longitude coordinates on the map UI

## Style Guidelines:

- Primary color: Soft blue (#A0C4FF) to evoke trust and precision.
- Background color: Light gray (#F0F4F8), almost white, for a clean interface.
- Accent color: Teal (#7B2CBF) for interactive elements (buttons, handles) to create focus and aid usability.
- Font: 'Inter', a sans-serif typeface with a modern, machined look, suitable for headlines and body text.
- Use simple, clear icons for map controls and interactive elements.
- Mobile-friendly layout optimized for Android WebView with a clean, intuitive design.
- Smooth transitions and animations for radius adjustments and map interactions.