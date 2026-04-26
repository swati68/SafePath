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
  const wakeLockRef = useRef(null)

  // API Base URL - empty string in PROD to use relative routing, local fallback for dev
  const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8000';

  // Auto-search when mode changes
  useEffect(() => {
    if (window.google && origin && destination && !loading) {
      handleSearch()
    }
  }, [mode])

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config`)
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
      zoom: 13
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

  const triggerSafeHaven = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn("Wake Lock failed:", err);
    }

    if (!navigator.geolocation) {
      alert("Geolocation is required for Safe Haven.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const currentLocation = new window.google.maps.LatLng(lat, lng);
        setOrigin(`${lat},${lng}`);

        const service = new window.google.maps.places.PlacesService(googleMap.current);
        const request = {
          location: currentLocation,
          rankBy: window.google.maps.places.RankBy.DISTANCE,
          keyword: 'police OR hospital OR pharmacy',
          openNow: true
        };

        service.nearbySearch(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            const nearest = results[0];
            const destLat = nearest.geometry.location.lat();
            const destLng = nearest.geometry.location.lng();
            setDestination(nearest.name); // Show name in UI instead of coordinates
            
            // Announce
            if (window.speechSynthesis) {
              if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(`Rerouting to the nearest safe haven at ${nearest.name}. Follow the blue line.`);
              window.currentUtterance = u; // Prevent garbage collection bug in Chrome
              u.rate = 0.92;
              u.pitch = 1.2;
              
              const voices = window.speechSynthesis.getVoices();
              const premiumVoice = voices.find(v => 
                v.name.includes("Moira") || v.name.includes("Fiona") || v.name.includes("Karen") || v.name.includes("Victoria") ||
                v.name.includes("Samantha") || v.name.includes("Premium") || v.name.includes("Google UK English Female") ||
                (v.lang.includes("en") && v.name.includes("Natural"))
              );
              if (premiumVoice) u.voice = premiumVoice;

              window.speechSynthesis.speak(u);
            }

            // Trigger search atomically, keep the voice playing, and pass the display name
            handleSearch(false, `${lat},${lng}`, `${destLat},${destLng}`, 'Pedestrian', true, nearest.name);
          } else {
            alert("No safe haven found nearby.");
          }
        });
      },
      () => alert("Unable to get current location for Safe Haven.")
    );
  };

  const startGlobalVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
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
      if (transcript.toLowerCase().includes('get me to safety')) {
        setIsListening(false);
        triggerSafeHaven();
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/parse-voice`, {
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
    
    if (isPlayingVoice || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    window.currentUtterance = utterance; // Prevent garbage collection bug in Chrome
    
    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality, natural-sounding female voices
    const premiumVoice = voices.find(v => 
      v.name.includes("Moira") || 
      v.name.includes("Fiona") ||
      v.name.includes("Karen") ||
      v.name.includes("Victoria") ||
      v.name.includes("Samantha") || 
      v.name.includes("Premium") || 
      v.name.includes("Google UK English Female") ||
      (v.lang.includes("en") && v.name.includes("Natural"))
    );
    if (premiumVoice) utterance.voice = premiumVoice;
    
    // Tweak rate and pitch for a "sweeter" and less robotic delivery
    utterance.rate = 0.92; // Slightly slower for natural pacing
    utterance.pitch = 1.2; // Slightly higher pitch for a sweeter tone
    utterance.onend = () => setIsPlayingVoice(false);
    
    setIsPlayingVoice(true);
    window.speechSynthesis.speak(utterance);
  }

  const handleSearch = async (autoPlayVoice = false, overrideOrigin = null, overrideDest = null, overrideMode = null, keepVoice = false, displayDest = null) => {
    const searchOrigin = overrideOrigin || origin;
    const searchDest = overrideDest || destination;
    const searchMode = overrideMode || mode;
    const finalDisplayDest = displayDest || destination || searchDest || "Destination";
    
    if (!searchOrigin || !searchDest) return
    setLoading(true)
    setData(null)
    clearMap()
    if (!keepVoice) {
      if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      setIsPlayingVoice(false)
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: searchOrigin, destination: searchDest, mode: searchMode })
      })
      
      const result = await res.json()
      if (res.ok) {
        setData(result)
        setSelectedRouteId(result.safest_route_id)
        drawRoutes(result.routes, result.safest_route_id, finalDisplayDest)
        
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

  const drawRoutes = (routes, activeId, finalDisplayDest = "Destination") => {
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
        strokeOpacity: isActive ? 0.8 : 0.3,
        strokeWeight: isActive ? 5 : 3,
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
          title: "Origin",
          zIndex: 100
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
          title: finalDisplayDest,
          zIndex: 100
        })
        
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; color: #1e293b; font-family: sans-serif; min-width: 150px;">
              <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800;">${finalDisplayDest}</h3>
              <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600;">Destination</p>
            </div>
          `
        })
        
        markerB.addListener('click', () => {
          infoWindow.open(googleMap.current, markerB)
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
    <div className="app-wrapper">
      <header className="top-header">
        <div className="header-brand">
          <div className="header-logo">🛡️</div>
          <div>
            <h1 className="header-title">SafePath Live</h1>
            <span className="header-subtitle">AI-powered urban safety navigation · NYC</span>
          </div>
        </div>

      </header>

      <div className="main-content">
        <div className="sidebar">
          <div className="travel-mode-toggle">
            <button 
              className={`mode-btn ${mode === 'Pedestrian' ? 'active' : ''}`}
              onClick={() => setMode('Pedestrian')}
            >
              🚶‍♂️ Walk
            </button>
            <button 
              className={`mode-btn ${mode === 'Cyclist' ? 'active' : ''}`}
              onClick={() => setMode('Cyclist')}
            >
              🚲 Bike
            </button>
          </div>

          <div className="form-container">
            <div className="form-label">TRAVEL MODE</div>
            <div className="input-group">
              <label className="form-label" style={{display:'none'}}>Origin</label>
              <div className="input-with-actions">
                <span style={{marginRight: '8px', fontWeight: 'bold'}}>A</span>
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
              <div className="input-with-actions">
                <span style={{marginRight: '8px', fontWeight: 'bold'}}>B</span>
                <input 
                  ref={destinationInputRef}
                  value={destination} 
                  onChange={e => setDestination(e.target.value)} 
                  placeholder="e.g. Central Park, NY" 
                />
              </div>
            </div>
            <button 
              className="compare-btn" 
              onClick={() => handleSearch(false)}
              disabled={loading}
            >
              {loading ? 'Analyzing Routes...' : 'Compare routes'}
            </button>
          </div>

          <div className="quick-demos-section">
            <div className="form-label" style={{marginTop:'10px'}}>QUICK DEMOS</div>
            <div className="quick-demos">
              <button className="demo-btn" onClick={() => { setOrigin('Times Square, NY'); setDestination('Union Square, NY'); handleSearch(false); }}>Times Square → Union Square</button>
              <button className="demo-btn" onClick={() => { setOrigin('Grand Central, NY'); setDestination('Washington Square Park, NY'); handleSearch(false); }}>Grand Central → Washington Square Park</button>
              <button className="demo-btn" onClick={() => { setOrigin('Bryant Park, NY'); setDestination('Chelsea Market, NY'); handleSearch(false); }}>Bryant Park → Chelsea Market</button>
            </div>
          </div>

          {data && (
            <>
              <div className="why-route-card">
                <div className="why-header">
                  <h3 className="why-title">WHY THIS ROUTE</h3>
                  <span className="why-weather">Mostly clear</span>
                </div>
                <p className="why-text">{data.explanation}</p>
                <button className="play-voice-btn" style={{marginTop:'10px', fontSize:'12px', background: 'transparent', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer'}} onClick={() => readExplanation(data.explanation)}>
                  {isPlayingVoice ? '⏸ Stop Voice' : '▶️ Play Voice Reasoning'}
                </button>
              </div>

              {data.routes.map(route => {
                const isSelected = route.id === selectedRouteId
                const isSafest = route.id === data.safest_route_id
                const isFastest = route.id === data.fastest_route_id
                
                if (!isSelected) {
                  return (
                    <div key={route.id} className="route-card-summary" onClick={() => handleSelectRoute(route.id)}>
                      <div className="rcs-left">
                        <h4 className="rcs-title">{isFastest ? "Fastest walk" : isSafest ? "Safest walk" : "Alternative walk"}</h4>
                        <span className={`rcs-score ${route.score > 0.7 ? 'safe' : ''}`}>Safety: {Math.round(route.score * 100)}/100</span>
                      </div>
                      <div className="rcs-right">
                        <span className="rcs-time">{route.duration.text}</span>
                      </div>
                    </div>
                  )
                }
                
                const details = route.details || { lighting: 0.57, weather: 0.33, time: 0.18 };
                const bullets = route.bullet_points || ["No NYPD reports..."];

                return (
                  <div key={route.id} className="route-card-detailed">
                    <div className="rc-header">
                      <div className="rc-header-top">
                        <p className="rc-nypd-text">{bullets[0]}</p>
                        <div className="rc-badges">
                          {isSafest && <span className="rc-badge-pill safe">Safest</span>}
                          {isFastest && <span className="rc-badge-pill fast">Fastest</span>}
                        </div>
                      </div>
                      <h2 className="rc-title">{isFastest ? "Fastest walk" : isSafest ? "Safest walk" : "Alternative walk"}</h2>
                      <p className="rc-subtitle">Shortest blocks with more direct crossings.</p>
                    </div>

                    <div className="rc-grid">
                      <div className="rc-stat">
                        <span className="rc-stat-label">SAFETY</span>
                        <span className="rc-stat-val">{route.score}</span>
                        <span className={`rc-stat-sub ${route.score > 0.7 ? 'safe' : ''}`}>{route.score > 0.7 ? 'Safe' : route.score > 0.4 ? 'Moderate' : 'High Risk'}</span>
                      </div>
                      <div className="rc-stat">
                        <span className="rc-stat-label">TIME</span>
                        <span className="rc-stat-val">{route.duration.text}</span>
                        <span className="rc-stat-sub">Baseline</span>
                      </div>
                      <div className="rc-stat">
                        <span className="rc-stat-label">DISTANCE</span>
                        <span className="rc-stat-val">{route.distance.text}</span>
                        <span className="rc-stat-sub">5 factors</span>
                      </div>
                    </div>

                    <div className="rc-gradient-bar">
                      <div className="rc-gradient-bg">
                        <div className="rc-gradient-fill"></div>
                      </div>
                      <div className="rc-gradient-marker" style={{ left: `${route.score * 100}%` }}></div>
                    </div>

                    <div className="rc-submetric">
                      <div className="rc-sub-top">
                        <h4 className="rc-sub-title">Lighting and visibility</h4>
                        <div className="rc-sub-bar-container">
                          <div className="rc-sub-bar-bg"><div className="rc-sub-bar-fill" style={{width: `${details.lighting * 100}%`, background: '#f59e0b'}}></div></div>
                          <span className="rc-sub-val">{details.lighting}</span>
                        </div>
                      </div>
                      <p className="rc-sub-desc">1 unresolved 311 streetlight/signal complaint sit within ~180m of this route.</p>
                    </div>

                    <div className="rc-submetric">
                      <div className="rc-sub-top">
                        <h4 className="rc-sub-title">Weather</h4>
                        <div className="rc-sub-bar-container">
                          <div className="rc-sub-bar-bg"><div className="rc-sub-bar-fill" style={{width: `${details.weather * 100}%`, background: '#f59e0b'}}></div></div>
                          <span className="rc-sub-val">{details.weather}</span>
                        </div>
                      </div>
                      <p className="rc-sub-desc">Mostly clear adds a low weather penalty for pedestrian travel.</p>
                    </div>

                    <div className="rc-submetric">
                      <div className="rc-sub-top">
                        <h4 className="rc-sub-title">Time-of-day risk</h4>
                        <div className="rc-sub-bar-container">
                          <div className="rc-sub-bar-bg"><div className="rc-sub-bar-fill" style={{width: `${details.time * 100}%`, background: '#ef4444'}}></div></div>
                          <span className="rc-sub-val">{details.time}</span>
                        </div>
                      </div>
                      <p className="rc-sub-desc">Current visibility and activity levels create a low time-based penalty.</p>
                    </div>

                    <ul className="rc-bullets">
                      {bullets.slice(1).map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="map-container">
          {data && origin && destination && (
            <div className="map-overlay">
              <div className="overlay-left">
                <p className="overlay-label">CANDIDATE ROUTE OVERLAY</p>
                <h2 className="overlay-title">{origin} → {destination}</h2>
              </div>
              <div className="overlay-right">
                <span className="overlay-badge">{data.routes.length} routes compared</span>
                <span className="overlay-badge">Pedestrian scoring</span>
              </div>
            </div>
          )}
          
          <div ref={mapRef} className="map-view"></div>
          
          <div className="map-legend">
            <div className="legend-item"><div className="legend-dot" style={{background: '#10b981'}}></div> Safest</div>
            <div className="legend-item"><div className="legend-dot" style={{background: '#f59e0b'}}></div> Fastest</div>
            <div className="legend-item"><div className="legend-dot" style={{background: '#3b82f6'}}></div> Alternate</div>
          </div>

          <button className="safe-haven-fab" onClick={triggerSafeHaven}>
            🚨 Emergency
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
