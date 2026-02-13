import { useState, useEffect } from 'react'
import stations from './stations.json'
import './App.css'

function App() {
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0)
  const [stationId, setStationId] = useState(100)
  const [noStationFound, setNoStationFound] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    if (navigator.language && navigator.language.toLowerCase().startsWith('zh')) {
      setLanguage('zh')
    }
  }, [])

  const isChinese = language === 'zh'

  const labels = {
    en: {
      title: 'Light Rail Schedule',
      systemTime: 'System Time',
      platform: 'Platform',
      noService: 'No service info',
      cars: 'Car(s)',
      loading: 'Loading...',
      noStation: 'No station found within 500m',
      locationError: 'Fail to get user location',
      unknownStation: 'Unknown Station'
    },
    zh: {
      title: '輕鐵班次',
      systemTime: '系統時間',
      platform: '月台',
      noService: '沒有班次資訊',
      cars: '卡車',
      loading: '載入中...',
      noStation: '500米內沒有車站',
      locationError: '無法獲取位置',
      unknownStation: '未知車站'
    }
  }

  const t = labels[isChinese ? 'zh' : 'en']

  const getStationName = (id) => {
    const station = stations.find((s) => s.stationId === id)
    return station ? (isChinese ? station.stationNameCht : station.stationNameEn) : t.unknownStation
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
      console.log('Getting user location...')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('User location obtained:', position.coords)
          const { latitude, longitude } = position.coords
          let minDistance = Infinity
          let nearestId = 100

          const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2); 
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
            const d = R * c; 
            return d;
          }

          stations.forEach((station) => {
            if (station.coordination) {
              const [lat, lng] = station.coordination.split(', ').map(Number)
              const distance = getDistanceFromLatLonInMeters(latitude, longitude, lat, lng)
              if (distance < minDistance) {
                minDistance = distance
                nearestId = station.stationId
                console.log(`Checking station ${station.stationNameEn} (ID: ${station.stationId}) - Distance: ${distance.toFixed(2)}m`)
              }
            }
          })

          setStationId(nearestId)
          if (minDistance > 500) {
            setNoStationFound(true)
          } else {
            setNoStationFound(false)
          }
        },
        (err) => {
          console.error(err)
          setLocationError('Fail to get user location')
        }
      )
    } else {
      setLocationError('Geolocation is not supported by this browser.')
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

  if (loading && !schedule) return <div className="loading">{t.loading}</div>

  return (
    <div className="container">
      <header>
        <h1>{t.title}</h1>
        {locationError && <div className="error">{t.locationError}</div>}
        {noStationFound && <div className="error">{t.noStation}</div>}
        <select 
          value={stationId} 
          onChange={(e) => {
            setStationId(parseInt(e.target.value))
            setNoStationFound(false)
          }}
          className="station-selector"
        >
          {stations.map((station) => (
            <option key={station.stationId} value={station.stationId}>
              {isChinese ? station.stationNameCht : station.stationNameEn}
            </option>
          ))}
        </select>
        {schedule && <span className="system-time">{t.systemTime}: {schedule.system_time}</span>}
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
            <h2>{t.platform} {schedule.platform_list[currentPlatformIndex].platform_id}</h2>
            <div className="route-list">
              {schedule.platform_list[currentPlatformIndex].route_list?.map((route, index) => (
                <div key={index} className="route-item">
                  <div className="route-info">
                    <div className="route-number">{route.route_no}</div>
                    <div className="destination">
                      {isChinese ? (
                          <div className="dest-ch">{route.dest_ch}</div>
                      ) : (
                          <div className="dest-en">{route.dest_en}</div>
                      )}
                    </div>
                  </div>
                  <div className="time">
                     <div className="time-en">{route.time_en}</div>
                  </div>
                  <div className="details">
                     {route.train_length} {t.cars}
                  </div>
                </div>
              ))}
              {(!schedule.platform_list[currentPlatformIndex].route_list || schedule.platform_list[currentPlatformIndex].route_list.length === 0) && (
                <div className="no-service">{t.noService}</div>
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
