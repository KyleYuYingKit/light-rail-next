import { useState, useEffect } from 'react'
import stations from './stations.json'
import './App.css'

function App() {
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0)
  const [stationId, setStationId] = useState(100)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  const getStationName = (id) => {
    const station = stations.find((s) => s.stationId === id)
    return station ? station.stationNameEn : 'Unknown Station'
  }

  const fetchData = async (id = stationId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${id}`)
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      const data = await response.json()
      setSchedule(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          let minDistance = Infinity
          let nearestId = 100

          stations.forEach((station) => {
            if (station.coordination) {
              const [lat, lng] = station.coordination.split(', ').map(Number)
              const distance = Math.pow(latitude - lat, 2) + Math.pow(longitude - lng, 2)
              if (distance < minDistance) {
                minDistance = distance
                nearestId = station.stationId
              }
            }
          })
          setStationId(nearestId)
        },
        (err) => console.error(err)
      )
    }
  }, [])

  useEffect(() => {
    fetchData(stationId)
    const interval = setInterval(() => {
      fetchData(stationId)
    }, 5000)
    return () => clearInterval(interval)
  }, [stationId])

  const nextPlatform = () => {
    if (!schedule?.platform_list) return
    setCurrentPlatformIndex((prev) => (prev + 1) % schedule.platform_list.length)
  }

  const prevPlatform = () => {
    if (!schedule?.platform_list) return
    setCurrentPlatformIndex((prev) => (prev - 1 + schedule.platform_list.length) % schedule.platform_list.length)
  }

  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX)

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) {
      nextPlatform()
    }
    if (isRightSwipe) {
      prevPlatform()
    }
  }

  if (loading && !schedule) return <div className="loading">Loading...</div>

  return (
    <div className="container">
      <header>
        <h1>Light Rail Schedule ({getStationName(stationId)})</h1>
        {schedule && <span className="system-time">System Time: {schedule.system_time}</span>}
      </header>

      {error && <div className="error">Error: {error}</div>}

      <div 
        className="carousel-container"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button className="nav-btn prev" onClick={prevPlatform}>&lt;</button>
        
        {schedule?.platform_list && schedule.platform_list.length > 0 && (
          <div className="platform-card carousel-card">
            <h2>Platform {schedule.platform_list[currentPlatformIndex].platform_id}</h2>
            <div className="route-list">
              {schedule.platform_list[currentPlatformIndex].route_list?.map((route, index) => (
                <div key={index} className="route-item">
                  <div className="route-info">
                    <div className="route-number">{route.route_no}</div>
                    <div className="destination">
                      <div className="dest-en">{route.dest_en}</div>
                      <div className="dest-ch">{route.dest_ch}</div>
                    </div>
                  </div>
                  <div className="time">
                     <div className="time-en">{route.time_en}</div>
                  </div>
                  <div className="details">
                     {route.train_length} Car(s)
                  </div>
                </div>
              ))}
              {(!schedule.platform_list[currentPlatformIndex].route_list || schedule.platform_list[currentPlatformIndex].route_list.length === 0) && (
                <div className="no-service">No service info</div>
              )}
            </div>
          </div>
        )}

        <button className="nav-btn next" onClick={nextPlatform}>&gt;</button>
      </div>

      <div className="carousel-indicators">
        {schedule?.platform_list?.map((_, index) => (
          <span 
            key={index} 
            className={`indicator ${index === currentPlatformIndex ? 'active' : ''}`}
            onClick={() => setCurrentPlatformIndex(index)}
          ></span>
        ))}
      </div>
    </div>
  )
}

export default App
