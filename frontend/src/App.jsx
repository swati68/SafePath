import { useState, useEffect, useRef } from 'react'

function App() {
  const [mode, setMode] = useState('Pedestrian')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [isPlayingVoice, setIsPlayingVoice] = useState(false)
  
  const mapRef = useRef(null)
  const googleMap = useRef(null)
  const polylines = useRef([])
  const markers = useRef([])
  const originInputRef = useRef(null)
  const destinationInputRef = useRef(null)
  const originAutocomplete = useRef(null)
  const destAutocomplete = useRef(null)
  const recognitionRef = useRef(null)

  // Auto-search when mode changes
  useEffect(() => {
    if (window.google && origin && destination && !loading) {
      handleSearch()
    }
  }, [mode])

  useEffect(() => {
    fetch('http://localhost:8000/api/config')
      .then(res => res.json())
      .then(config => {
        if (!window.google && config.googleMapsApiKey) {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=places`
          script.async = true
          script.onload = () => {
            initMap()
            initAutocomplete()
          }
          document.body.appendChild(script)
        } else if (window.google) {
          initMap()
          initAutocomplete()
        }
      })
      .catch(err => console.error("Could not load config", err))
  }, [])

  const initMap = () => {
    if (!mapRef.current) return
    googleMap.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40.7580, lng: -73.9855 },
      zoom: 13,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      ]
    })
  }

  const initAutocomplete = () => {
    if (!window.google || !window.google.maps.places) return

    if (originInputRef.current) {
      if (originAutocomplete.current) window.google.maps.event.clearInstanceListeners(originAutocomplete.current);
      originAutocomplete.current = new window.google.maps.places.Autocomplete(originInputRef.current)
      originAutocomplete.current.addListener('place_changed', () => {
        const place = originAutocomplete.current.getPlace()
        setOrigin(place.formatted_address || place.name)
      })
    }

    if (destinationInputRef.current) {
      if (destAutocomplete.current) window.google.maps.event.clearInstanceListeners(destAutocomplete.current);
      destAutocomplete.current = new window.google.maps.places.Autocomplete(destinationInputRef.current)
      destAutocomplete.current.addListener('place_changed', () => {
        const place = destAutocomplete.current.getPlace()
        setDestination(place.formatted_address || place.name)
      })
    }
  }

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (window.google && window.google.maps.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === "OK" && results[0]) {
                setOrigin(results[0].formatted_address);
              } else {
                setOrigin(`${lat},${lng}`);
              }
            });
          } else {
            setOrigin(`${lat},${lng}`);
          }
        },
        () => alert("Unable to retrieve your location. Please ensure location services are enabled.")
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  }

  const startGlobalVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlayingVoice(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };
    
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      try {
        const res = await fetch('http://localhost:8000/api/parse-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        });
        const parsed = await res.json();
        
        let overrideOrigin = null;
        let overrideDest = null;
        let overrideMode = null;
        
        if (parsed.origin) {
          setOrigin(parsed.origin);
          overrideOrigin = parsed.origin;
        }
        if (parsed.destination) {
          setDestination(parsed.destination);
          overrideDest = parsed.destination;
        }
        if (parsed.mode && (parsed.mode === 'Pedestrian' || parsed.mode === 'Cyclist')) {
          setMode(parsed.mode);
          overrideMode = parsed.mode;
        }
        
        if (overrideOrigin || overrideDest) {
           handleSearch(true, overrideOrigin, overrideDest, overrideMode);
        }
      } catch(e) {
        console.error(e);
        alert("Could not process voice request.");
      }
    };
    
    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsListening(false);
    }
  }

  const readExplanation = (text) => {
    if (!window.speechSynthesis) return;
    
    if (isPlayingVoice) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => 
      v.name.includes("Samantha") || 
      v.name.includes("Premium") || 
      v.name.includes("Google UK English Female") ||
      (v.lang.includes("en") && v.name.includes("Natural"))
    );
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.rate = 0.95; 
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingVoice(false);
    
    setIsPlayingVoice(true);
    window.speechSynthesis.speak(utterance);
  }

  const handleSearch = async (autoPlayVoice = false, overrideOrigin = null, overrideDest = null, overrideMode = null) => {
    const searchOrigin = overrideOrigin || origin;
    const searchDest = overrideDest || destination;
    const searchMode = overrideMode || mode;
    
    if (!searchOrigin || !searchDest) return
    setLoading(true)
    setData(null)
    clearMap()
    window.speechSynthesis?.cancel()
    setIsPlayingVoice(false)
    
    try {
      const res = await fetch('http://localhost:8000/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: searchOrigin, destination: searchDest, mode: searchMode })
      })
      
      const result = await res.json()
      if (res.ok) {
        setData(result)
        setSelectedRouteId(result.safest_route_id)
        drawRoutes(result.routes, result.safest_route_id)
        
        if (autoPlayVoice === true) {
          setTimeout(() => readExplanation(result.explanation), 500);
        }
      } else {
        alert(result.detail || "Error finding routes")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to connect to backend. Is it running?")
    } finally {
      setLoading(false)
    }
  }

  const clearMap = () => {
    polylines.current.forEach(p => p.setMap(null))
    polylines.current = []
    markers.current.forEach(m => m.setMap(null))
    markers.current = []
  }

  const drawRoutes = (routes, activeId) => {
    if (!window.google) return
    clearMap()
    
    const bounds = new window.google.maps.LatLngBounds()

    const decodePolyline = (encoded) => {
      let points = []; let index = 0, len = encoded.length; let lat = 0, lng = 0
      while (index < len) {
        let b, shift = 0, result = 0
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat
        shift = 0; result = 0
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng
        points.push({ lat: (lat / 1E5), lng: (lng / 1E5) })
      }
      return points
    }

    const getRouteColor = (score) => {
      if (score > 0.7) return '#10b981'; // Safe
      if (score > 0.4) return '#f59e0b'; // Moderate
      return '#ef4444'; // Unsafe
    }

    const sortedRoutes = [...routes].sort((a, b) => a.id === activeId ? 1 : -1)

    sortedRoutes.forEach(route => {
      const isActive = route.id === activeId
      const path = decodePolyline(route.route_data.overview_polyline)
      
      const routeColor = getRouteColor(route.score)
      
      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: routeColor,
        strokeOpacity: isActive ? 1.0 : 0.4,
        strokeWeight: isActive ? 6 : 4,
        zIndex: isActive ? 10 : 1
      })
      polyline.setMap(googleMap.current)
      polylines.current.push(polyline)

      path.forEach(p => bounds.extend(p))

      if (isActive) {
        const startPoint = path[0]
        const endPoint = path[path.length - 1]

        const markerA = new window.google.maps.Marker({
          position: startPoint,
          map: googleMap.current,
          label: { text: "A", color: "white", fontWeight: "bold" },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff'
          },
          title: "Origin"
        })
        const markerB = new window.google.maps.Marker({
          position: endPoint,
          map: googleMap.current,
          label: { text: "B", color: "white", fontWeight: "bold" },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#8b5cf6',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff'
          },
          title: "Destination"
        })
        markers.current.push(markerA, markerB)

        route.hazards.forEach(h => {
          const marker = new window.google.maps.Marker({
            position: { lat: h.lat, lng: h.lng },
            map: googleMap.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#ef4444',
              fillOpacity: 0.8,
              strokeWeight: 2,
              strokeColor: '#fff'
            },
            title: h.type
          })
          markers.current.push(marker)
        })
      }
    })

    googleMap.current.fitBounds(bounds)
  }

  const handleSelectRoute = (id) => {
    setSelectedRouteId(id)
    if (data) {
      drawRoutes(data.routes, id)
    }
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="header">
          <h1><span>🛡️</span> SafePath Live</h1>
        </div>

        <div className="mode-toggle">
          <button 
            className={`mode-btn ${mode === 'Pedestrian' ? 'active' : ''}`}
            onClick={() => setMode('Pedestrian')}
          >
            🚶‍♂️ Pedestrian
          </button>
          <button 
            className={`mode-btn ${mode === 'Cyclist' ? 'active' : ''}`}
            onClick={() => setMode('Cyclist')}
          >
            🚲 Cyclist
          </button>
        </div>

        <div className="input-group">
          <label>Origin</label>
          <div className="input-with-actions">
            <input 
              ref={originInputRef}
              value={origin} 
              onChange={e => setOrigin(e.target.value)} 
              placeholder="e.g. Times Square, NY" 
            />
            <button className="action-icon" onClick={handleGetCurrentLocation} title="Use current location">📍</button>
          </div>
        </div>

        <div className="input-group">
          <label>Destination</label>
          <div className="input-with-actions">
            <input 
              ref={destinationInputRef}
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              placeholder="e.g. Central Park, NY" 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="search-btn" 
            onClick={() => handleSearch(false)}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? 'Analyzing Risks...' : 'Find Safest Route'}
          </button>
          <button 
            className={`search-btn ${isListening ? 'recording' : ''}`} 
            onClick={startGlobalVoiceInput}
            title="Voice Search"
            style={{ padding: '14px 20px', backgroundColor: isListening ? '#ef4444' : '#3b82f6' }}
          >
            🎤
          </button>
        </div>

        {data && (
          <div className="results">
            <div className="ai-explanation">
              <span className="ai-badge">AI INSIGHT</span>
              <button className="play-voice-btn" onClick={() => readExplanation(data.explanation)}>
                {isPlayingVoice ? '⏸ Stop' : '▶️ Play Voice'}
              </button>
              <p style={{marginTop: '15px'}}>{data.explanation}</p>
            </div>

            {data.routes.map(route => {
              const isFastest = route.id === data.fastest_route_id
              const isSafest = route.id === data.safest_route_id
              const isSelected = route.id === selectedRouteId

              let cardBorderColor = '';
              if (isSelected) {
                if (route.score > 0.7) cardBorderColor = 'var(--safe)';
                else if (route.score > 0.4) cardBorderColor = 'var(--warning)';
                else cardBorderColor = 'var(--danger)';
              }

              return (
                <div 
                  key={route.id} 
                  className={`route-card ${isSelected ? 'selected' : ''}`}
                  style={isSelected ? { borderColor: cardBorderColor, boxShadow: `0 0 0 1px ${cardBorderColor}` } : {}}
                  onClick={() => handleSelectRoute(route.id)}
                >
                  <div className="route-header">
                     <div className="route-title">
                      {isSafest && "🛡️ Safest "}
                      {isFastest && !isSafest && "⚡ Fastest "}
                      {!isSafest && !isFastest && "Alternative "}
                      Route
                    </div>
                    <div className="route-time">{route.duration.text}</div>
                  </div>
                  
                  <div className="route-stats">
                    <span className={`stat-badge ${
                      route.score > 0.7 ? 'safe' : route.score > 0.4 ? 'moderate' : 'high'
                    }`}>
                      Safety: {Math.round(route.score * 100)}/100
                    </span>
                    <span className="stat-badge" style={{ backgroundColor: '#334155' }}>
                      {route.distance.text}
                    </span>
                  </div>

                  <div className="hazards-list">
                    {route.hazards.slice(0, 3).map((h, i) => (
                      <span key={i} className="hazard-item">⚠️ {h.type}</span>
                    ))}
                    {route.hazards.length > 3 && (
                      <span className="hazard-item">+{route.hazards.length - 3} more</span>
                    )}
                    {route.hazards.length === 0 && (
                      <span className="hazard-item" style={{color: '#10b981', borderColor: 'rgba(16,185,129,0.2)'}}>
                        ✅ No known hazards
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="map-container">
        <div ref={mapRef} className="map-view"></div>
      </div>
    </div>
  )
}

export default App
